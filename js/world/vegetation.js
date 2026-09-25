// Prefabs that sit on the ground where the world generator put them. Their heights are the
// samples for the terrain heightmap. Unknown names are harmless — they just never match.
// Trees are also placed as items when an asset lists their name as an internal ID.
export const TERRAIN_PREFABS = {
  tree: [
    'Beech1', 'Beech_small1', 'Beech_small2', 'Birch1', 'Birch2', 'Birch1_aut', 'Birch2_aut', 'Oak1',
    'FirTree', 'FirTree_small', 'FirTree_small_dead', 'Pinetree_01', 'SwampTree1', 'SwampTree2',
    'SwampTree2_darkland', 'YggaShoot1', 'YggaShoot2', 'YggaShoot3', 'YggaShoot_small1',
  ],
  stump: ['stubbe', 'Beech_Stub', 'BirchStub', 'OakStub', 'FirTree_Stub', 'Pinetree_01_Stub', 'SwampTree1_Stub', 'FirTree_oldLog', 'SwampTree2_log'],
  bush: ['Bush01', 'Bush01_heath', 'Bush02_en', 'shrub_2', 'shrub_2_heath', 'RaspberryBush', 'BlueberryBush', 'CloudberryBush'],
  rock: [
    'rock1_mountain', 'rock2_mountain', 'rock3_mountain', 'rock2_heath', 'rock4_heath', 'rock4_forest',
    'rock4_coast', 'Rock_3', 'Rock_4', 'Rock_7', 'rock_mistlands1', 'rock_mistlands2',
  ],
  ore: ['MineRock_Tin', 'MineRock_Copper', 'MineRock_Obsidian', 'MineRock_Meadows', 'rock4_copper', 'silvervein', 'rock3_silver', 'mudpile', 'mudpile2', 'mudpile_beacon'],
  pickable: [
    'Pickable_Stone', 'Pickable_Flint', 'Pickable_Branch', 'Pickable_Mushroom', 'Pickable_Mushroom_yellow',
    'Pickable_Dandelion', 'Pickable_Thistle', 'Pickable_SeedCarrot', 'Pickable_SeedTurnip', 'Pickable_SeedOnion',
    'Pickable_Barley_Wild', 'Pickable_Flax_Wild', 'Pickable_Tin', 'Pickable_Mushroom_JotunPuffs', 'Pickable_Mushroom_Magecap',
  ],
};

export const TERRAIN_PREFAB_NAMES = Object.values(TERRAIN_PREFABS).flat();
