const displaySelection = {
  none: 0,
  seeOwnOnly: 1,
  seeOwnAndOthers_singleView_dropdown: 2,
  seeOwnAndOthers_comparisonView_dropdown: 3,
  seeOwnAndAllCombined: 4,
};

const progressType = {
  none: 0,
  leaderBoard: 1,
  digitalStamp: 2,
};

const rewardType = {
  none: 0,
  point: 1,
};

const buFilterType = {
  allUser: 1,
  includeUser: 2,
  excludeUser: 3,
};

module.exports = {
  displaySelection,
  progressType,
  rewardType,
  buFilterType,
};
