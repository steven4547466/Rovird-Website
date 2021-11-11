function getUrl(path) {
  return `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}/${path}`
}

async function getData(url = "") {
  const response = await fetch(url, {
    method: "GET",
    mode: "same-origin",
    cache: "no-cache",
    credentials: "same-origin",
    redirect: "follow",
    referrerPolicy: "no-referrer"
  })
  return response.json()
}

async function postJSONData(url = "", data = {}) {
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

async function postMultipartData(url = "", data = {}) {
  const response = await fetch(url, {
    method: "POST",
    mode: "same-origin",
    cache: "no-cache",
    credentials: "same-origin",
    redirect: "follow",
    referrerPolicy: "no-referrer",
    body: data
  })
  return response.json()
}

function wait(ms) {
  return new Promise(resolve => {setTimeout(resolve, ms)})
}