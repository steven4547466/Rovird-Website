// Credit: AntiBoomz's BTRoblox Extension
// https://chrome.google.com/webstore/detail/btroblox-making-roblox-be/hbkpclpemjeibhioopcebchdmohaieln?hl=en-US

"use strict"

const fetch = require("node-fetch")
const RBXParser = require("./RBXParaser")
const fs = require("fs")
const https = require("https")
const cache = {}
const cacheLookup = []

function bufferToString(buffer) {
  if (buffer instanceof ArrayBuffer) { buffer = new Uint8Array(buffer) }
  const result = []

  for (let i = 0; i < buffer.length; i += 0x8000) {
    result.push(String.fromCharCode.apply(null, buffer.subarray(i, i + 0x8000)))
  }

  return result.join("")
}


const AssetCache = {
  loadAnimation: createMethod(buffer => RBXParser.parseAnimation(RBXParser.parseModel(buffer))),
  loadModel: createMethod(buffer => RBXParser.parseModel(buffer)),
  loadMesh: createMethod(buffer => RBXParser.parseMesh(buffer)),
  loadBuffer: createMethod(buffer => buffer),
  loadText: createMethod(buffer => bufferToString(buffer)),

  toAssetUrl(id) {
    return `https://assetdelivery.roblox.com/v1/asset/?id=${+id}`
  },

  resolveAssetId(url) {
    const params = resolveAssetUrlParams(url)

    if (params) {
      return params.get("id")
    }

    return null
  }
}

const resourceToAsset = {
  "res/previewer/characterModels.rbxm": "rbxassetid://2957693598&version=3",
  "res/previewer/face.png": "rbxassetid://2957705858",

  "res/previewer/meshes/leftarm.mesh": "rbxassetid://2957740508",
  "res/previewer/meshes/leftleg.mesh": "rbxassetid://2957740624",
  "res/previewer/meshes/rightarm.mesh": "rbxassetid://2957740703",
  "res/previewer/meshes/rightleg.mesh": "rbxassetid://2957740776",
  "res/previewer/meshes/torso.mesh": "rbxassetid://2957740857",
  "res/previewer/heads/head.mesh": "rbxassetid://2957715294",

  "res/previewer/compositing/CompositPantsTemplate.mesh": "rbxassetid://2957742558",
  "res/previewer/compositing/CompositShirtTemplate.mesh": "rbxassetid://2957742631",
  "res/previewer/compositing/CompositTShirt.mesh": "rbxassetid://2957742706",
  "res/previewer/compositing/R15CompositLeftArmBase.mesh": "rbxassetid://2957742791",
  "res/previewer/compositing/R15CompositRightArmBase.mesh": "rbxassetid://2957742881",
  "res/previewer/compositing/R15CompositTorsoBase.mesh": "rbxassetid://2957742957"
}

function resolveAssetUrlParams(url) {
  if (url.startsWith("rbxassetid://")) {
    url = `https://assetdelivery.roblox.com/v1/asset/?id=${url.slice(13)}`
  } else if (url.startsWith("rbxhttp://")) {
    url = `https://www.roblox.com/${url.slice(10)}`
  }

  try {
    const urlInfo = new URL(url)
    if (!urlInfo.pathname.match(/\/*asset\/*$/i)) {
      return null
    }

    return urlInfo.searchParams
  } catch (ex) { }

  return null
}

function resolveAssetUrl(url) {
  try { new URL(url) }
  catch (ex) { throw new TypeError(`Invalid URL: "${String(url)}"`) }

  if (url.match(/https?:\/\/..\.rbxcdn\.com/)) {
    return url.replace(/^http:/, "https:")
  }

  const params = resolveAssetUrlParams(url)
  if (!params) {
    throw new Error(`Invalid Asset Url: "${url}"`)
  }

  params.sort()

  const paramString = params.toString()
  return `https://assetdelivery.roblox.com/v1/asset/?${paramString.toString()}`
}

function createMethod(constructor) {

  return async (strict, url, cb, retries) => {
    let id = null
    if (typeof strict !== "boolean") {
      retries = cb
      cb = url
      url = strict
      strict = false
    }

    if (!strict && Number.isSafeInteger(+url)) {
      id = url
      if (cache[id]) return cb(cache[id])
      url = AssetCache.toAssetUrl(url)
    }
    try {
      const resolvedUrl = resolveAssetUrl(url)
      const file = await download(resolvedUrl, __dirname + "/temp/" + id)


      let parsed = constructor(file)
      cache[id] = parsed
      let timeout = setTimeout(() => {
        if (cache[id]) delete cache[id]
        let index = cacheLookup.find((e) => e.id == id)
        if (index != -1) cacheLookup.splice(index, 1)
      }, 600000)
      cacheLookup.unshift({ id, timeout })
      if (cacheLookup.length > 1000) {
        let c = cache.pop()
        delete cache[c.id]
        clearTimeout(c.timeout)
      }
      cb(cache[id])
      try {
        fs.unlinkSync(__dirname + "/temp/" + id)
      } catch (e) { }
    } catch (err) {
      if (err = "Not a valid RBXM file") {
        console.log("Invalid file")
        try {
          fs.unlinkSync(__dirname + "/temp/" + id)
        } catch (e) { }
        if (retries > 5) {
          cb(null)
          return
        }
        setTimeout(() => {
          AssetCache.loadModel(id, cb, retries ? retries + 1 : 1)
        }, 5000)
      }
    }
  }
}

function download(url, filePath) {
  return new Promise(async (resolve, reject) => {
    try {
      let file = fs.createWriteStream(filePath)
      let res = await fetch(url)
      res.body.pipe(file)
      file.on("finish", () => {
        fs.readFile(filePath, (err, file) => {
          if (err) return reject(err)
          resolve(file)
        })
      })

      file.on("error", err => {
        fs.unlink(filePath, () => reject(err))
      })
    } catch (e) { reject(e) }
  })
}

// function download(url, filePath, file) {
//   let noFile = file == null
//   return new Promise((resolve, reject) => {
//     if (noFile) file = fs.createWriteStream(filePath)
//     const request = https.get(url, { headers: { 'User-Agent': 'Rovird' } }, response => {
//       if (response.statusCode === 301 || response.statusCode === 302) {
//         return download(response.headers.location, filePath, file)
//       }
//       if (response.statusCode !== 200) {
//         reject(new Error(`Failed to get "${url}" (${response.statusCode})`))
//         return
//       }
//       response.pipe(file)
//     })

//     if (noFile) {
//       file.on("finish", () => {
//         fs.readFile(filePath, (err, file) => {
//           if (err) return reject(err)
//           resolve(file)
//         })
//       })

//       file.on("error", err => {
//         fs.unlink(filePath, () => reject(err))
//       })
//     }

//     request.on("error", err => {
//       fs.unlink(filePath, () => reject(err))
//     })

//     request.end()
//   })
// }

module.exports = AssetCache