const natural = require("natural")
const fs = require("fs")

let brain = null

function obtainBrain() {
  return new Promise((resolve, reject) => {
    if (brain != null) return resolve()
    if (fs.existsSync("./brain/brain.json")) {
      natural.BayesClassifier.load("./brain/brain.json", null, function (err, classifier) {
        if (err) return reject(err)
        brain = classifier
        resolve()
      })
    } else {
      brain = new natural.BayesClassifier()
      resolve()
    }
  })
}

function saveBrain() {
  if (!brain) return console.error("No brain to save!")
  return new Promise((resolve, reject) => {
    brain.save("./brain/brain.json", function (err) {
      if (err) return reject(err)
      console.log("Brain saved!")
      resolve()
    })
  })
}

async function train() {
  await obtainBrain()
  let trainingData = JSON.parse(fs.readFileSync("./brain/trainingData.json", { encoding: "utf8" }))
  for (let data of trainingData) {
    brain.addDocument(data.Source, data.Output)
  }
  brain.train()
  await saveBrain(brain)
}

async function run(input) {
  await obtainBrain()
  return brain.getClassifications(input)
}

module.exports = { run, train }