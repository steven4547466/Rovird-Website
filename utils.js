function bufferToString(buffer) {
  if (buffer instanceof ArrayBuffer) { buffer = new Uint8Array(buffer) }
  const result = []

  for (let i = 0; i < buffer.length; i += 0x8000) {
    result.push(String.fromCharCode.apply(null, buffer.subarray(i, i + 0x8000)))
  }

  return result.join("")
}

function resolveLine(str) {
  return str.replace(/\\(\d+)/g, (match, g1) => {
    return String.fromCharCode(g1)
  })
}

function countSpacesInARow(str) {
  let lastChar = ""
  let maxInRow = 0
  let inRow = 1
  for (let char of str) {
    if (lastChar == " " && char == " ") {
      inRow++
    } else {
      if (inRow > maxInRow) {
        maxInRow = inRow
        inRow = 1
      }
    }
    lastChar = char
  }
  if (inRow > maxInRow) {
    maxInRow = inRow
  }
  return maxInRow >= 8 ? maxInRow : 0
}

module.exports = { bufferToString, resolveLine, countSpacesInARow }