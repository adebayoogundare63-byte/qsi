function getNextClassCode(index, classSequence = ['JSS1Q', 'JSS1S', 'JSS1I', 'JSS1Y', 'JSS1N']) {
  return classSequence[index % classSequence.length];
}

function getClassSequenceIndex(index) {
  return index % 5;
}

function getNextAdmissionNumber(currentAdmissionNumber, usedNumbers = new Set()) {
  const currentValue = Number(String(currentAdmissionNumber).replace(/\D/g, '')) || 0;
  let nextValue = currentValue + 1;
  while (usedNumbers.has(nextValue)) {
    nextValue += 1;
  }
  return nextValue;
}

module.exports = {
  getNextClassCode,
  getClassSequenceIndex,
  getNextAdmissionNumber,
};
