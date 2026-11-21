import pool from '../config/mysql.js';
import bcrypt from 'bcrypt';

// GET /api/users/me
export const getMe = async (req, res) => {
  try {
    const { userId } = req.user;
    const [rows] = await pool.query(
      `SELECT u.userId, u.orgId, u.name, u.email, u.createdAt,
              o.name AS orgName, o.plan
       FROM users u
       JOIN organizations o ON u.orgId = o.orgId
       WHERE u.userId = ?`,
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo el perfil', error: error.message });
  }
};

// PUT /api/users/me — solo datos básicos, sin roles ni equipo por ahora.
export const updateMe = async (req, res) => {
  try {
    const { userId, orgId } = req.user;
    const { name, email } = req.body || {};

    if (!name || !email) {
      return res.status(400).json({ message: 'Nombre y correo son obligatorios' });
    }

    await pool.query('UPDATE users SET name = ?, email = ? WHERE userId = ?', [name.trim(), email.trim(), userId]);

    res.json({ message: 'Perfil actualizado', user: { userId, orgId, name: name.trim(), email: email.trim() } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ese correo ya está en uso en tu organización' });
    }
    res.status(500).json({ message: 'Error actualizando el perfil', error: error.message });
  }
};

// PATCH /api/users/me/password
export const changePassword = async (req, res) => {
  try {
    const { userId } = req.user;
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Contraseña actual y nueva son obligatorias' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const [rows] = await pool.query('SELECT password FROM users WHERE userId = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const matches = await bcrypt.compare(currentPassword, rows[0].password);
    if (!matches) {
      return res.status(401).json({ message: 'La contraseña actual no es correcta' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE userId = ?', [hashed, userId]);

    res.json({ message: 'Contraseña actualizada' });
  } catch (error) {
    res.status(500).json({ message: 'Error cambiando la contraseña', error: error.message });
  }
};
