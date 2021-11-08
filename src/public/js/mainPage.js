async function postData(url = "", data = {}) {
  const response = await fetch(url, {
    method: "POST",
    mode: "same-origin",
    cache: "no-cache",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    redirect: "follow",
    referrerPolicy: "no-referrer",
    body: JSON.stringify(data)
  })
  return response.json()
}

function submitAsset() {
  return alert("Not yet implemented. Check back soon!")
  let id = document.getElementById("asset-id-input").value
  postData(`${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}/jobs`, [{ assetId: id }])
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