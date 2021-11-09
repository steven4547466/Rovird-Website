function submitAsset() {
  let id = document.getElementById("asset-id-input").value
  postData(getUrl("jobs"), [{ assetId: id, getSource: true, getNames: true }])
    .then(async (data) => {
      while (true) {
        let res = await getData(getUrl(`jobs-status?jobIds=${data.jobId}`))
        if (res[data.jobId]) break
        await wait(500)
      }
      window.location.href = `viewjobs?jobIds=${data.jobId}`
    })
    .catch(console.error)
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