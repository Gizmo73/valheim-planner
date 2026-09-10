export function mapToGrid(mapX, mapY, layer, mpp) {
  const ax = layer.gridAnchorX != null ? layer.gridAnchorX : layer.originX;
  const ay = layer.gridAnchorY != null ? layer.gridAnchorY : layer.originY;
  return {
    x: (mapX - ax) * mpp,
    y: (mapY - ay) * mpp,
  };
}

export function gridToMap(gridX, gridY, layer, mpp) {
  const ax = layer.gridAnchorX != null ? layer.gridAnchorX : layer.originX;
  const ay = layer.gridAnchorY != null ? layer.gridAnchorY : layer.originY;
  return {
    x: ax + gridX / mpp,
    y: ay + gridY / mpp,
  };
}

export function snapToGrid(gridX, gridY) {
  return {
    x: Math.round(gridX),
    y: Math.round(gridY),
  };
}

export function gridSizeFromMapPixels(mapPixels, mpp) {
  return mapPixels * mpp;
}
