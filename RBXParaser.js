// Credit: AntiBoomz's BTRoblox Extension
// https://chrome.google.com/webstore/detail/btroblox-making-roblox-be/hbkpclpemjeibhioopcebchdmohaieln?hl=en-US


const ByteReader = require("./ByteReader")
const jsdom = require("jsdom")

"use strict"

// http://www.classy-studios.com/Downloads/RobloxFileSpec.pdf

function bufferToString(buffer) {
  if (buffer instanceof ArrayBuffer) { buffer = new Uint8Array(buffer) }
  const result = []

  for (let i = 0; i < buffer.length; i += 0x8000) {
    result.push(String.fromCharCode.apply(null, buffer.subarray(i, i + 0x8000)))
  }

  return result.join("")
}

class RBXInstance {
  static new(className) {
    if (typeof className !== "string") throw new Error("className is not a string")
    return new RBXInstance(className)
  }

  constructor(className) {
    if (typeof className !== "string") throw new Error("className is not a string")
    this.Children = []
    this.Properties = []

    this.setProperty("ClassName", className, "string")
    this.setProperty("Name", "Instance", "string")
    this.setProperty("Parent", null, "Instance")
  }

  setProperty(name, value, type) {
    if (!type) {
      if (typeof value === "boolean") {
        type = "bool"
      } else if (value instanceof RBXInstance) {
        type = "Instance"
      } else {
        throw new TypeError("You need to specify property type")
      }
    }

    let descriptor = this.Properties[name]
    if (descriptor) {
      if (descriptor.type !== type) throw new Error(`Property type mismatch ${type} !== ${descriptor.type}`)

      if (name === "Parent" && descriptor.value instanceof RBXInstance) {
        const index = descriptor.value.Children.indexOf(this)
        if (index !== -1) {
          descriptor.value.Children.splice(index, 1)
        }
      }

      descriptor.value = value
    } else {
      descriptor = this.Properties[name] = { type, value }
    }

    if (name === "Parent") {
      if (descriptor.value instanceof RBXInstance) {
        descriptor.value.Children.push(this)
      }
    }

    if (name !== "Children" && name !== "Properties" && !(name in Object.getPrototypeOf(this))) {
      this[name] = value
    }
  }

  getProperty(name) {
    const descriptor = this.Properties[name]
    return descriptor ? descriptor.value : undefined
  }

  hasProperty(name) {
    return name in this.Properties
  }
}

const RBXBinaryParser = {
  HeaderBytes: [0x3C, 0x72, 0x6F, 0x62, 0x6C, 0x6F, 0x78, 0x21, 0x89, 0xFF, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00],
  Faces: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]],
  DataTypes: [
    null, "string", "bool", "int", "float", "double", "UDim", "UDim2", // 7
    "Ray", "Faces", "Axes", "BrickColor", "Color3", "Vector2", "Vector3", "Vector2int16", // 15
    "CFrame", "Quaternion", "Enum", "Instance", "Vector3int16", "NumberSequence", "ColorSequence", // 22
    "NumberRange", "Rect2D", "PhysicalProperties", "Color3uint8", "int64", "SharedString", "UnknownScriptFormat" // 29
  ],

  parse(buffer) {
    const reader = new ByteReader(buffer)

    if (!reader.Match(this.HeaderBytes)) {
      THROW_DEV_WARNING("[ParseRBXBin] Header bytes did not match (Did binary format change?)")
    }

    const groupsCount = reader.UInt32LE()
    const instancesCount = reader.UInt32LE()
    reader.Jump(8)

    const parser = {
      result: [],
      sharedStrings: [],
      groups: new Array(groupsCount),
      instances: new Array(instancesCount)
    }

    while (true) {
      const chunkType = reader.String(4)
      const chunkData = reader.LZ4()

      if (chunkType === "END\0") {
        break
      }

      const chunkReader = new ByteReader(chunkData)

      switch (chunkType) {
        case "INST":
          this.parseINST(parser, chunkReader)
          break
        case "PROP":
          this.parsePROP(parser, chunkReader)
          break
        case "PRNT":
          this.parsePRNT(parser, chunkReader)
          break
        case "SSTR":
          this.parseSSTR(parser, chunkReader)
          break

        case "META": break
        case "SIGN": break

        default:
          THROW_DEV_WARNING(`[ParseRBXBin] Unknown chunk '${chunkType}'`)
      }
    }

    if (reader.GetRemaining() > 0) {
      THROW_DEV_WARNING("[ParseRBXBin] Unexpected data after END")
    }

    return parser.result
  },

  parseSSTR(parser, chunk) {
    chunk.UInt32LE() // version
    const stringCount = chunk.UInt32LE()

    for (let i = 0; i < stringCount; i++) {
      const md5 = chunk.Array(16)
      const length = chunk.UInt32LE()
      const value = chunk.String(length)

      parser.sharedStrings[i] = { md5, value }
    }
  },

  parseINST(parser, chunk) {
    const groupId = chunk.UInt32LE()
    const className = chunk.String(chunk.UInt32LE())
    chunk.Byte() // isService
    const instCount = chunk.UInt32LE()
    const instIds = chunk.RBXInterleavedInt32(instCount)

    const group = parser.groups[groupId] = {
      ClassName: className,
      Objects: []
    }

    let instId = 0
    for (let i = 0; i < instCount; i++) {
      instId += instIds[i]
      group.Objects.push(parser.instances[instId] = RBXInstance.new(className))
    }
  },

  parsePROP(parser, chunk) {
    const group = parser.groups[chunk.UInt32LE()]
    const prop = chunk.String(chunk.UInt32LE())

    if (chunk.GetRemaining() <= 0) {
      return // empty chunk?
    }

    const dataType = chunk.Byte()
    const typeName = this.DataTypes[dataType]
    const instCount = group.Objects.length

    if (!typeName) {
      THROW_DEV_WARNING(`[ParseRBXBin] Unknown dataType 0x${dataType.toString(16).toUpperCase()} (${dataType}) for ${group.ClassName}.${prop}`)
      return
    }

    let values = new Array(instCount)

    switch (typeName) {
      case "string":
        for (let i = 0; i < instCount; i++) {
          const len = chunk.UInt32LE()
          values[i] = chunk.String(len)
        }
        break
      case "bool":
        for (let i = 0; i < instCount; i++) {
          values[i] = chunk.Byte() !== 0
        }
        break
      case "int":
        values = chunk.RBXInterleavedInt32(instCount)
        break
      case "float":
        values = chunk.RBXInterleavedFloat(instCount)
        break
      case "double":
        for (let i = 0; i < instCount; i++) {
          values[i] = chunk.DoubleLE()
        }
        break
      case "UDim": {
        const scale = chunk.RBXInterleavedFloat(instCount)
        const offset = chunk.RBXInterleavedInt32(instCount)
        for (let i = 0; i < instCount; i++) {
          values[i] = [scale[i], offset[i]]
        }
        break
      }
      case "UDim2": {
        const scaleX = chunk.RBXInterleavedFloat(instCount)
        const scaleY = chunk.RBXInterleavedFloat(instCount)
        const offsetX = chunk.RBXInterleavedInt32(instCount)
        const offsetY = chunk.RBXInterleavedInt32(instCount)
        for (let i = 0; i < instCount; i++) {
          values[i] = [
            [scaleX[i], offsetX[i]],
            [scaleY[i], offsetY[i]]
          ]
        }
        break
      }
      case "Ray": {
        for (let i = 0; i < instCount; i++) {
          values[i] = [
            [chunk.RBXFloatLE(), chunk.RBXFloatLE(), chunk.RBXFloatLE()],
            [chunk.RBXFloatLE(), chunk.RBXFloatLE(), chunk.RBXFloatLE()]
          ]
        }
        break
      }
      case "Faces":
        for (let i = 0; i < instCount; i++) {
          const data = chunk.Byte()

          values[i] = {
            Right: !!(data & 1),
            Top: !!(data & 2),
            Back: !!(data & 4),
            Left: !!(data & 8),
            Bottom: !!(data & 16),
            Front: !!(data & 32)
          }
        }
        break
      case "Axes":
        for (let i = 0; i < instCount; i++) {
          const data = chunk.Byte()
          values[i] = {
            X: !!(data & 1),
            Y: !!(data & 2),
            Z: !!(data & 4)
          }
        }
        break
      case "BrickColor":
        values = chunk.RBXInterleavedUint32(instCount)
        break
      case "Color3": {
        const red = chunk.RBXInterleavedFloat(instCount)
        const green = chunk.RBXInterleavedFloat(instCount)
        const blue = chunk.RBXInterleavedFloat(instCount)
        for (let i = 0; i < instCount; i++) {
          values[i] = [red[i], green[i], blue[i]]
        }
        break
      }
      case "Vector2": {
        const vecX = chunk.RBXInterleavedFloat(instCount)
        const vecY = chunk.RBXInterleavedFloat(instCount)
        for (let i = 0; i < instCount; i++) {
          values[i] = [vecX[i], vecY[i]]
        }
        break
      }
      case "Vector3": {
        const vecX = chunk.RBXInterleavedFloat(instCount)
        const vecY = chunk.RBXInterleavedFloat(instCount)
        const vecZ = chunk.RBXInterleavedFloat(instCount)
        for (let i = 0; i < instCount; i++) {
          values[i] = [vecX[i], vecY[i], vecZ[i]]
        }
        break
      }
      case "Vector2int16": break // Not used anywhere?
      case "CFrame": {
        for (let vi = 0; vi < instCount; vi++) {
          const value = values[vi] = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]
          const type = chunk.Byte()

          if (type !== 0) {
            const right = this.Faces[Math.floor((type - 1) / 6)]
            const up = this.Faces[Math.floor(type - 1) % 6]
            const back = [
              right[1] * up[2] - up[1] * right[2],
              right[2] * up[0] - up[2] * right[0],
              right[0] * up[1] - up[0] * right[1]
            ]

            for (let i = 0; i < 3; i++) {
              value[3 + i * 3] = right[i]
              value[4 + i * 3] = up[i]
              value[5 + i * 3] = back[i]
            }
          } else {
            for (let i = 0; i < 9; i++) {
              value[i + 3] = chunk.FloatLE()
            }
          }
        }

        const vecX = chunk.RBXInterleavedFloat(instCount)
        const vecY = chunk.RBXInterleavedFloat(instCount)
        const vecZ = chunk.RBXInterleavedFloat(instCount)
        for (let i = 0; i < instCount; i++) {
          values[i][0] = vecX[i]
          values[i][1] = vecY[i]
          values[i][2] = vecZ[i]
        }
        break
      }
      // case "Quaternion": break // Not used anywhere?
      case "Enum":
        values = chunk.RBXInterleavedUint32(instCount)
        break
      case "Instance": {
        const refIds = chunk.RBXInterleavedInt32(instCount)

        let refId = 0
        for (let i = 0; i < instCount; i++) {
          refId += refIds[i]
          values[i] = parser.instances[refId]
        }
        break
      }
      case "Vector3int16":
        break // Not used anywhere?
      case "NumberSequence": {
        for (let i = 0; i < instCount; i++) {
          const seqLength = chunk.UInt32LE()
          const seq = values[i] = []

          for (let j = 0; j < seqLength; j++) {
            seq.push({
              Time: chunk.FloatLE(),
              Value: chunk.FloatLE(),
              Envelope: chunk.FloatLE()
            })
          }
        }
        break
      }
      case "ColorSequence":
        for (let i = 0; i < instCount; i++) {
          const seqLength = chunk.UInt32LE()
          const seq = values[i] = []

          for (let j = 0; j < seqLength; j++) {
            seq.push({
              Time: chunk.FloatLE(),
              Color: [chunk.FloatLE(), chunk.FloatLE(), chunk.FloatLE()],
              EnvelopeMaybe: chunk.FloatLE()
            })
          }
        }
        break
      case "NumberRange":
        for (let i = 0; i < instCount; i++) {
          values[i] = {
            Min: chunk.FloatLE(),
            Max: chunk.FloatLE()
          }
        }
        break
      case "Rect2D": {
        const x0 = chunk.RBXInterleavedFloat(instCount)
        const y0 = chunk.RBXInterleavedFloat(instCount)
        const x1 = chunk.RBXInterleavedFloat(instCount)
        const y1 = chunk.RBXInterleavedFloat(instCount)

        for (let i = 0; i < instCount; i++) {
          values[i] = [x0[i], y0[i], x1[i], y1[i]]
        }
        break
      }
      case "PhysicalProperties":
        for (let i = 0; i < instCount; i++) {
          const enabled = chunk.Byte() !== 0
          values[i] = {
            CustomPhysics: enabled,
            Density: enabled ? chunk.RBXFloatLE() : null,
            Friction: enabled ? chunk.RBXFloatLE() : null,
            Elasticity: enabled ? chunk.RBXFloatLE() : null,
            FrictionWeight: enabled ? chunk.RBXFloatLE() : null,
            ElasticityWeight: enabled ? chunk.RBXFloatLE() : null
          }
        }
        break
      case "Color3uint8": {
        const rgb = chunk.Array(instCount * 3)

        for (let i = 0; i < instCount; i++) {
          values[i] = [rgb[i] / 255, rgb[i + instCount] / 255, rgb[i + instCount * 2] / 255]
        }
        break
      }
      case "int64": { // Two's complement
        const bytes = chunk.Array(instCount * 8)

        for (let i = 0; i < instCount; i++) {
          let byte0 = bytes[i + instCount * 0] * (256 ** 3) + bytes[i + instCount * 1] * (256 ** 2) +
            bytes[i + instCount * 2] * 256 + bytes[i + instCount * 3]

          let byte1 = bytes[i + instCount * 4] * (256 ** 3) + bytes[i + instCount * 5] * (256 ** 2) +
            bytes[i + instCount * 6] * 256 + bytes[i + instCount * 7]

          const neg = byte1 % 2
          byte1 = (byte0 % 2) * (2 ** 31) + (byte1 + neg) / 2
          byte0 = Math.floor(byte0 / 2)

          if (byte0 < 2097152) {
            const value = byte0 * (256 ** 4) + byte1
            values[i] = String(neg ? -value : value)
          } else { // Slow path
            let result = ""

            while (byte1 || byte0) {
              const cur0 = byte0
              const res0 = cur0 % 10
              byte0 = (cur0 - res0) / 10

              const cur1 = byte1 + res0 * (256 ** 4)
              const res1 = cur1 % 10
              byte1 = (cur1 - res1) / 10

              result = res1 + result
            }

            values[i] = (neg ? "-" : "") + (result || "0")
          }
        }
        break
      }
      case "SharedString": {
        const indices = chunk.RBXInterleavedUint32(instCount)

        for (let i = 0; i < instCount; i++) {
          values[i] = parser.sharedStrings[indices[i]].value
        }
        break
      }
      case "UnknownScriptFormat":
        for (let i = 0; i < instCount; i++) {
          values[i] = "<UnknownScriptFormat>"
        }
        break
      default:
        THROW_DEV_WARNING(`[ParseRBXBin] Unimplemented dataType '${typeName}' for ${group.ClassName}.${prop}`)
    }

    values.forEach((value, i) => {
      group.Objects[i].setProperty(prop, value, typeName)
    })
  },

  parsePRNT(parser, chunk) {
    chunk.Byte()
    const parentCount = chunk.UInt32LE()
    const childIds = chunk.RBXInterleavedInt32(parentCount)
    const parentIds = chunk.RBXInterleavedInt32(parentCount)

    let childId = 0
    let parentId = 0
    for (let i = 0; i < parentCount; i++) {
      childId += childIds[i]
      parentId += parentIds[i]

      const child = parser.instances[childId]
      if (parentId === -1) {
        parser.result.push(child)
      } else {
        child.setProperty("Parent", parser.instances[parentId], "Instance")
      }
    }
  }
}

const RBXXmlParser = {
  Transforms: {
    CFrame: ["X", "Y", "Z", "R00", "R01", "R02", "R10", "R11", "R12", "R20", "R21", "R22"],
    Vector3: ["X", "Y", "Z"],
    Vector2: ["X", "Y"]
  },

  parse(buffer) {
    const x = bufferToString(buffer).replace(/class="(.*)"/gi, "")
    const p = new jsdom.JSDOM("")
    const xml = new p.window.DOMParser().parseFromString(x, "text/xml").documentElement
    const parser = {
      result: [],
      refs: {},
      refWait: [],
      sharedStrings: {}
    }

    const sharedStrings = xml.querySelector(":scope > SharedStrings")
    if (sharedStrings) {
      Object.values(sharedStrings.children).forEach(child => {
        if (child.nodeName !== "SharedString") { return }
        const md5 = child.getAttribute("md5")
        let value

        try { value = xml.window.atob(child.textContent.trim()) }
        catch (ex) { console.error(ex) }

        if (typeof md5 === "string" && typeof value === "string") {
          parser.sharedStrings[md5] = { md5, value }
        }
      })
    }

    Object.values(xml.children).forEach(child => {
      if (child.nodeName === "Item") {
        parser.result.push(this.parseItem(parser, child))
      }
    })

    return parser.result
  },

  parseItem(parser, node) {
    const inst = RBXInstance.new(node.className)
    const referent = node.getAttribute("referent")

    if (referent) {
      parser.refs[referent] = inst
      parser.refWait.forEach(wait => {
        if (wait.id === referent) {
          parser.refWait.splice(parser.refWait.indexOf(wait), 1)
          wait.inst.setProperty(wait.name, inst, "Instance")
        }
      })
    }

    Object.values(node.children).forEach(childNode => {
      switch (childNode.nodeName) {
        case "Item": {
          const child = this.parseItem(parser, childNode)
          child.setProperty("Parent", inst)
          break
        }
        case "Properties":
          this.parseProperties(parser, inst, childNode)
          break
      }
    })

    return inst
  },

  parseProperties(parser, inst, targetNode) {
    Object.values(targetNode.children).forEach(propNode => {
      const name = propNode.attributes.name.value
      const value = propNode.textContent

      switch (propNode.nodeName.toLowerCase()) {
        case "content":
        case "string":
        case "protectedstring":
        case "binarystring": return inst.setProperty(name, value.trim(), "string")
        case "double": return inst.setProperty(name, +value, "double")
        case "float": return inst.setProperty(name, +value, "float")
        case "int": return inst.setProperty(name, +value, "int")
        case "int64": return inst.setProperty(name, value, "int64")
        case "bool": return inst.setProperty(name, value.toLowerCase() === "true", "bool")
        case "token": return inst.setProperty(name, +value, "Enum")
        case "color3":
        case "color3uint8": return inst.setProperty(name, [(+value >>> 16 & 255) / 255, (+value >>> 8 & 255) / 255, (+value & 255) / 255], "Color3")
        case "coordinateframe": {
          const cframe = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]
          Object.values(propNode.children).forEach(x => {
            const index = this.Transforms.CFrame.indexOf(x.nodeName.toUpperCase())
            if (index !== -1) {
              cframe[index] = +x.textContent
            }
          })

          return inst.setProperty(name, cframe, "CFrame")
        }
        case "vector2": {
          const vector2 = [0, 0]
          Object.values(propNode.children).forEach(x => {
            const index = this.Transforms.Vector2.indexOf(x.nodeName.toUpperCase())
            if (index !== -1) {
              vector2[index] = +x.textContent
            }
          })

          return inst.setProperty(name, vector2, "Vector2")
        }
        case "vector3": {
          const vector3 = [0, 0, 0]
          Object.values(propNode.children).forEach(x => {
            const index = this.Transforms.Vector3.indexOf(x.nodeName.toUpperCase())
            if (index !== -1) {
              vector3[index] = +x.textContent
            }
          })

          return inst.setProperty(name, vector3, "Vector3")
        }
        case "udim2": {
          const udim2 = [
            [0, 0],
            [0, 0]
          ]

          Object.values(propNode.children).forEach(x => {
            const nodeName = x.nodeName.toUpperCase()

            if (nodeName === "XS") { udim2[0][0] = +x.textContent }
            else if (nodeName === "XO") { udim2[0][1] = +x.textContent }
            else if (nodeName === "YS") { udim2[1][0] = +x.textContent }
            else if (nodeName === "YO") { udim2[0][1] = +x.textContent }
          })

          return inst.setProperty(name, udim2, "UDim2")
        }
        case "physicalproperties": {
          const props = { CustomPhysics: false, Density: null, Friction: null, Elasticity: null, FrictionWeight: null, ElasticityWeight: null }
          Object.values(propNode.children).forEach(x => {
            if (x.nodeName in props) {
              props[x.nodeName] = x.nodeName === "CustomPhysics" ? x.textContent.toLowerCase() === "true" : +x.textContent
            }
          })

          return inst.setProperty(name, props, "PhysicalProperties")
        }
        case "ref": {
          const target = parser.refs[value] || null
          if (!target && value.toLowerCase() !== "null") {
            parser.refWait.push({
              inst, name,
              id: value
            })
          }

          return inst.setProperty(name, target, "Instance")
        }
        case "sharedstring": {
          const md5 = value.trim()
          const sharedString = parser.sharedStrings[md5].value

          return inst.setProperty(name, sharedString, "SharedString")
        }
        case "colorsequence":
        case "numberrange":
        case "numbersequence":
          return
        default:
          THROW_DEV_WARNING(`[ParseRBXXml] Unknown dataType ${propNode.nodeName} for ${inst.ClassName}.${name}`, propNode.innerHTML)
      }
    })
  }
}

module.exports = {
  parseModel(buffer) {
    const reader = new ByteReader(buffer)
    if (reader.String(7) !== "<roblox") {
      throw new Error("Not a valid RBXM file")
    }

    if (reader.Byte() === 0x21) {
      return RBXBinaryParser.parse(buffer)
    }

    return RBXXmlParser.parse(buffer)
  }
}