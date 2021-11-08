function submitAsset() {
  return alert("Not yet implemented. Check back soon!")
  let id = document.getElementById("asset-id-input").value
  postData(getUrl("jobs"), [{ assetId: id }])
    .then(data => {
      console.log(data)
    })
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