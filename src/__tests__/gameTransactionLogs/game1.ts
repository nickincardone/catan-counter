export const game1 = [
  {
    type: 'RESOURCE_GAIN',
    playerName: 'NickTheSwift',
    resources: {
      sheep: 0,
      wheat: 0,
      brick: 0,
      tree: 1,
      ore: 0,
    },
  },
  {
    type: 'RESOURCE_GAIN',
    playerName: 'Beagle77',
    resources: {
      sheep: 0,
      wheat: 0,
      brick: 4,
      tree: 0,
      ore: 1,
    },
  },
  {
    type: 'RESOURCE_GAIN',
    playerName: 'Hobbie6244',
    resources: {
      sheep: 2,
      wheat: 0,
      brick: 0,
      tree: 0,
      ore: 5,
    },
  },
  {
    type: 'RESOURCE_GAIN',
    playerName: '88ym88',
    resources: {
      sheep: 0,
      wheat: 0,
      brick: 1,
      tree: 0,
      ore: 1,
    },
  },
  // I've cut out all the middle stuff to help with debugging
  {
    type: 'ROBBER_STEAL',
    stealerName: 'Beagle77',
    victimName: 'Hobbie6244',
    stolenResource: null,
  },
  {
    type: 'ROBBER_STEAL',
    stealerName: 'Hobbie6244',
    victimName: 'Beagle77',
    stolenResource: null,
  },
  {
    type: 'ROBBER_STEAL',
    stealerName: 'Hobbie6244',
    victimName: 'Beagle77',
    stolenResource: null,
  },
];
