const AssetCache = require("./AssetCache")
const crypto = require("crypto")
const brain = require("./brain/brain")

// Not viruses
// score(7567983240)
// score(7828144123)
// score(7908534022)

// Viruses
// score(5108960396)
// score(3664252382)
// score(381046418)

// require("fs").readFile("Matchmaker.rbxm", (err, file) => {
//   scoreScript(require("./RBXParaser").parseModel(file)[0], {}, [])
// })

// score(5698193573)

const preventCyclic = {}

const tests = [
  {
    func: (line) => {
      return (/loadstring|gnirtsdaol/gi).test(line)
    },
    flagReason: "Script contains loadstring"
  },
  {
    func: (line) => {
      return (/eriuqer/gi).test(line)
    },
    flagReason: "Require obfuscation"
  },
  {
    func: (line) => {
      return (/getfenv\(\)\[(\"|')require(\"|')\]/gi).test(line)
    },
    flagReason: "Common virus require obfuscation"
  },
  {
    func: async (line, additional) => {
      let regex = /require\(([0-9]+)\)/gi
      let match = null
      let checkAfter = additional.flags.length
      while ((match = regex.exec(line)) != null) {
        let id = Number(match[1])
        await new Promise(resolve => {
          AssetCache.loadModel(id, async (model) => {
            if (!preventCyclic[additional.jobId]) preventCyclic[additional.jobId] = []
            if (preventCyclic[additional.jobId].includes(id)) return resolve()
            preventCyclic[additional.jobId].push(id)
            if (model == null) {
              additional.flags.push([])
              let index = additional.flags.length - 1
              additional.flags[index].push(new Flag(null, `Script is externally required. Layer #${additional.isExternal + 1}`))
              additional.flags[index].push(new Flag(null, `Unable to download asset after 5 retries`))
              let data = { flags: additional.flags[index], isExternal: additional.isExternal + 1, name: "Unknown", assetId: id }
              overview[crypto.randomUUID()] = data
              return
            }
            for (let i = 0; i < model.length; i++) {
              await checkChildrenFromScript(model[i], additional.overview, additional.flags, additional.isExternal + 1, id, additional.jobId)
              resolve()
            }
          })
        })
      }
      return additional.flags.slice(checkAfter).some(f => f.length > 1)
    },
    flagReason: "Required module (or its children) has flags"
  },
  {
    func: (line) => {
      let match = line.match(/require\([^)]+\)|require,/gi)
      if (!match) return false
      for (let m of match) {
        if ((/\.\.|tonumber/gi).test(m)) return true
      }
      return false
    },
    flagReason: "Possible require of unwanted module"
  },
  {
    func: (line, additional) => {
      return additional.isExternal == 0 && (/obfuscate|obfuscator|(il|li|ii|ll|i|l){5,}|SynapseXen|OBA Engine|=\s{0,}getfenv[^\(]|=\s{0,}string.byte[^\(]|=\s{0,}string.char[^\(]|(getfenv|string\.byte|string\.char|table\.concat|setmetatable|string\.sub)[^\(]/gi).test(line)
    },
    flagReason: "Script is obfuscated or minified"
  },
  {
    func: (line, additional) => {
      return additional.isExternal > 0 && (/obfuscate|obfuscator|(il|li|ii|ll|i|l){5,}|SynapseXen|OBA Engine|=\s{0,}getfenv|=\s{0,}string.byte|=\s{0,}string.char|(getfenv|string\.byte|string\.char|table\.concat|setmetatable|string\.sub)[^\(]/gi).test(line)
    },
    flagReason: "Script is external and obfuscated or minified"
  },
  {
    func: (line) => {
      let lower = line.toLowerCase()
      return ["c-rex", "vaccine", "infection", "script......or is it...", "4d being", "thisscriptisajumpstarttoaheã¯â¿â½lthylifestyle", "micolord", "propergrã¯â¿â½mmerneededinphilosiphallocations,insertnoobhere", "bryant90", "oh snap you got infected xd xd xd", "wormed", "n0isescript", "virus", "istã¯â¿â½rthere", "garmo hacked ur place", "n00b 4tt4ck!", "dã¯â¿â½ã¯â¿â½ã¯â¿â½ã¯â¿â½ã¯â¿â½ã¯â¿â½ã¯â¿â½ã¯â¿â½ã¯â¿â½ã¯â¿â½ã¯â¿â½ã¯â¿â½ã¯â¿â½ã¯â¿â½ng.........you got owned...", "letgo09", "sonicthehedgehogxx made this!!", "vivrus", "wtfz0r", "imahakwtfz", "i'm getting t1r33d", "system error 69605x09423", "stfu noob", "skapettaja", "freestylemã¯â¿â½ygoanywhereifneeded", "hello...i ã¯â¿â½m your new lord lolz", "hello i am your new lord lolz", "elkridge fire department", "zackisk", "join teh moovment!", "kill tem!", "stocksound", "deth 2 teh samurai!", "ohai", "oh snap you got infected xd xd xd", "no samurai plzzz", "4d being", "virus", "4dbeing", "4d being", "loser", "infected", "rolf", "wildfire", "geometry", "guest talker", "anti-lag", "snap infection", "numbrez", "imahakwtfz", "wtfzor", "d??????????????ng.........you got owned...", "vivrus", "zomg saved", "hello...i ?m your new lord lolz", "worm", "guest_talking_script", "snapreducer", "snap-reducer", "datacontrollers", "chaotic", "teleportscript", "spreadify", "antivirussoftware", "2_2_1_1_s_s_", "safity lock", "ropack", "no availiblitly lock", "protection", "whfcjgysa", "073dea7p", "snap reducer", "rofl", "anti lag", "antilag", "antivirus", "anti-virus", "anti virus", "guest free chat script", "lol", "bob", "snap remover", "snapremover", "n00b 4tt4ck", "garmo hacked ur place", "?9001", "bryant90", "dont worry im a friendly virus", "isavirus", "wormed", "stanley12345678910", "micolord", "charlie84", "cahrlie84", "skapettaja", "stfu noob", "random?goeshere:3", "making cat ice cream make me happy!", "antivirisis", "antiviris", "77?", "iamheretohe?lyourplace", "propergr?mmerneededinphilosiphallocations,insertnoobhere", "i'm getting t1r33d", "h4xxx :3", "sunstaff", "boomboom9188", "freestylem?ygoanywhereifneeded", "thisscriptisajumpstarttoahe?lthylifestyle", "d??????????????ng.........you got owned...", "deidara4 is sick of you noobs.", "feelfreetoins3rtgramm?tic?lerrorshere", "nomnomnom1 will hack you too! mwahaha!", "zxmlfcsajorwq#)cxfdre)$#q)jcousew#)@!hoifds(aeq#hi*dfhri(#fa", "nonoidon'tneedallofyourawkw?rdsovietarguments", "ist?rthere", "**virusmaster**", "vivurursdd", "monke farting jistu", "holy father of joe", "vmprotect op"]
        .some(f => lower.includes(f))
    },
    flagReason: "Script contains known virus text"
  },
  {
    func: (line) => {
      return line.toLowerCase().includes("rovird_donotcheck")
    },
    flagReason: "Script contains Rovird_DoNotCheck (possibly adding unwanted scripts to DoNotCheck)"
  }
]

function score(assetId) {
  AssetCache.loadModel(assetId, async model => {
    if (model == null) return [new Flag(null, "Unable to download asset after 5 retries")]
    let information = []
    for (let i = 0; i < model.length; i++) {
      if (model[i].ClassName.includes("Script") || (model[i].ClassName.trim() == "" && model[i].Source && model[i].Source.length > 0)) {
        model[i].UUID = crypto.randomUUID()
        information.push((await scoreScript(model[i], {}, [], 0, assetId)))
      } else {
        await checkChildren(model[i], information, assetId)
      }
    }
  })
}

async function scoreScript(script, overview = {}, flags = [], isExternal = 0, assetId = 0, jobId = "") {
  if (!script.UUID && isExternal == 0) return
  if (!script.Source) return
  let source = script.Source.replace(/\t/g, "    ")
  let sourceByLine = source.split("\n")
  let lastLineIndentation = 0
  let inComment = false
  flags.push([])
  let index = flags.length - 1
  if (isExternal > 0) flags[index].push(new Flag(null, `Script is externally required. Layer #${isExternal}`))
  for (let child of script.Children) {
    await scoreScript(child, overview, flags)
  }
  // let aiAnalysis = {}
  for (let i = 0; i < sourceByLine.length; i++) {
    if (sourceByLine[i].trim().length == 0) continue
    let line = resolveLine(sourceByLine[i]).trim()
    if (inComment) {
      if (line.includes("]]")) {
        inComment = false
        line = line.slice(line.indexOf("]]") + 2).trim()
      } else {
        continue
      }
    }
    if (!inComment && line.includes("--[[")) {
      line = line.slice(0, line.indexOf("--[[")).trim()
      inComment = true
    }
    if (line.trim().startsWith("--")) continue
    if (line.includes("--")) {
      line = line.slice(0, line.indexOf("--")).trim()
    }
    line = line.trim()
    if(line.length == 0) continue
    // let analysis = await brain.run(line)
    // for (let entry of analysis) {
    //   if (aiAnalysis[entry.label] == null) aiAnalysis[entry.label] = 0
    //   aiAnalysis[entry.label] += entry.value 
    // }
    let curLineIndentation = (line.match(/^ {0,}/g) || [""])[0].length;
    let isHidden = false
    if ((curLineIndentation - lastLineIndentation) > 30 || countSpacesInARow(line) > lastLineIndentation + 32) {
      flags[index].push(new Flag(i, "Possible hidden code"))
      isHidden = true
    }
    if ((line.length - curLineIndentation) > 500) {
      flags[index].push(new Flag(i, "Line is excessively long (500+ characters)"))
    }
    for (let test of tests) {
      if ((await test.func(line, { flags, isExternal, overview, jobId }))) {
        flags[index].push(new Flag(i, test.flagReason))
      }
    }
    if (!isHidden) lastLineIndentation = curLineIndentation
  }
  // for (let k of Object.keys(aiAnalysis)) {
  //   aiAnalysis[k] = aiAnalysis[k]/sourceByLine.length
  // }
  let data = { flags: flags[index], isExternal, /*aiAnalysis*/ }
  if (isExternal > 0) {
    data.name = script.Name
    data.assetId = assetId
  }
  overview[script.UUID || crypto.randomUUID()] = data
  // if (index == 0) console.log(flags)
  return overview
}

async function checkChildren(model, information, assetId, jobId = "") {
  for (let child of model.Children) {
    if (child.ClassName.includes("Script") || (child.ClassName.trim() == "" && child.Source && child.Source.length > 0)) {
      child.UUID = crypto.randomUUID()
      information.push((await scoreScript(child, {}, [], 0, assetId, jobId)))
    } else {
      await checkChildren(child, information, assetId, jobId)
    }
  }
}

async function checkChildrenFromScript(model, overview, flags, isExternal, assetId, jobId) {
  await scoreScript(model, overview, flags, isExternal, assetId, jobId)
  for (let child of model.Children) {
    if (child.ClassName.includes("Script")) {
      await scoreScript(child, overview, flags, isExternal, assetId, jobId)
    } else {
      await checkChildrenFromScript(child, overview, flags, isExternal, assetId, jobId)
    }
  }
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

function removeCyclic(jobId) {
  if (preventCyclic[jobId]) delete preventCyclic[jobId]
}

class Flag {
  constructor(line, reason) {
    this.line = line !== null ? line + 1 : null
    this.reason = reason
  }
}

module.exports = { score, scoreScript, removeCyclic }