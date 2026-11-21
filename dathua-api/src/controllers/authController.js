import pool from '../config/mysql.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { TRIAL_DAYS } from '../config/plans.js';

// Registro inicial: crea Organización y Usuario admin en una sola transacción
export const register = async (req, res) => {
  const { orgName, userName, email, password } = req.body;

  if (!orgName || !userName || !email || !password) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Insertar Organización (arranca en plan BASICO, en prueba gratuita)
    const [orgResult] = await connection.query(
      `INSERT INTO organizations (name, plan, subscriptionStatus, trialEndsAt)
       VALUES (?, 'BASICO', 'trialing', DATE_ADD(NOW(), INTERVAL ? DAY))`,
      [orgName, TRIAL_DAYS]
    );
    const orgId = orgResult.insertId;

    // 2. Hashear Contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Insertar Usuario ligado a la Organización
    const [userResult] = await connection.query(
      'INSERT INTO users (orgId, name, email, password) VALUES (?, ?, ?, ?)',
      [orgId, userName, email, hashedPassword]
    );
    const userId = userResult.insertId;

    await connection.commit();

    // 4. Generar Token JWT
    const token = jwt.sign(
      { userId, orgId, email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Organización y usuario registrados correctamente',
      token,
      user: { userId, orgId, name: userName, email }
    });
  } catch (error) {
    await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'El correo electrónico ya está registrado para esta organización' });
    }

    res.status(500).json({ message: 'Error en el servidor al registrar', error: error.message });
  } finally {
    connection.release();
  }
};

// Inicio de sesión
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email y contraseña requeridos' });
  }

  try {
    // El email es único por organización (uq_org_email), no globalmente:
    // la misma persona puede tener cuenta en más de una organización. Por
    // eso no se puede asumir que el primer resultado es el correcto — hay
    // que probar la contraseña contra cada cuenta que comparta ese email.
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    let user = null;
    for (const candidate of users) {
      if (await bcrypt.compare(password, candidate.password)) {
        user = candidate;
        break;
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { userId: user.userId, orgId: user.orgId, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        userId: user.userId,
        orgId: user.orgId,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al iniciar sesión', error: error.message });
  }
};