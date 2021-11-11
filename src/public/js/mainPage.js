function submitAsset() {
  let id = document.getElementById("asset-id-input").value
  if (id) {
    postJSONData(getUrl("jobs"), [{ assetId: id, getSource: true, getNames: true }])
      .then(async (data) => {
        while (true) {
          let res = await getData(getUrl(`jobs-status?jobIds=${data.jobId}`))
          if (res[data.jobId]) break
          await wait(500)
        }
        window.location.href = `viewjobs?jobIds=${data.jobId}`
      })
      .catch(console.error)
  } else {
    let file = document.getElementById("file-upload").files[0]
    if (file) {
      let formData = new FormData()
      formData.append("file", file)
      formData.append("options", JSON.stringify({getSource: true, getNames: true}))
      postMultipartData(getUrl("jobs"), formData)
        .then(async (data) => {
          while (true) {
            let res = await getData(getUrl(`jobs-status?jobIds=${data.jobId}`))
            if (res[data.jobId]) break
            await wait(500)
          }
          window.location.href = `viewjobs?jobIds=${data.jobId}`
        })
    }
  }
}

function validateId(event) {
  let ev = event || window.event

  let key = null
  if (ev.type === "paste") {
    key = event.clipboardData.getData("text/plain")
  } else {
    key = String.fromCharCode(ev.keyCode || ev.which)
  }
  let regex = /[0-9]/
  if (!regex.test(key)) {
    ev.returnValue = false
    if (ev.preventDefault) ev.preventDefault()
  }
}