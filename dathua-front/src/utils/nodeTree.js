// Arma el árbol de jerarquía (parentNodeId) a partir de la lista plana de
// nodos de una sucursal. Un nodo cuyo padre no está en la lista (o no tiene
// padre) se trata como raíz — así un padre eliminado nunca deja huérfanos
// invisibles en la vista de árbol.
export function buildNodeTree(nodes) {
  const byId = new Map(nodes.map((n) => [n.nodeId, { ...n, children: [] }]))
  const roots = []

  for (const node of byId.values()) {
    if (node.parentNodeId && byId.has(node.parentNodeId)) {
      byId.get(node.parentNodeId).children.push(node)
    } else {
      roots.push(node)
    }
  }

  const byRootFirst = (a, b) => Number(b.isRootGateway) - Number(a.isRootGateway) || a.name.localeCompare(b.name)
  const sortRecursive = (list) => {
    list.sort(byRootFirst)
    list.forEach((n) => sortRecursive(n.children))
  }
  sortRecursive(roots)

  return roots
}

// Agrupa los equipos de una sucursal por zona (una sección por zona + una
// de "Sin zona"), en vez de una sola lista plana donde la zona es apenas
// una etiqueta perdida entre otros datos. Dentro de cada grupo se arma el
// árbol solo con los equipos de ese grupo — si el padre real de un equipo
// vive en otra zona, se marca con `externalParentName` para no perder esa
// relación aunque no se dibuje anidada.
export function groupNodesByZone(nodes, zones) {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]))

  function decorate(list) {
    const idsInGroup = new Set(list.map((n) => n.nodeId))
    const tree = buildNodeTree(list)
    for (const root of tree) {
      if (root.parentNodeId && !idsInGroup.has(root.parentNodeId)) {
        root.externalParentName = byId.get(root.parentNodeId)?.name || null
      }
    }
    return tree
  }

  const zoneGroups = zones
    .map((z) => ({
      zoneId: z.zoneId,
      name: z.name,
      tree: decorate(nodes.filter((n) => n.zoneId === z.zoneId)),
    }))
    .filter((g) => g.tree.length > 0)

  const unzonedTree = decorate(nodes.filter((n) => !n.zoneId))

  return { zoneGroups, unzonedTree }
}
