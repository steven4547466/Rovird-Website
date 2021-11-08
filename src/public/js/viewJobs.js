function getJobs() {
  if (window.location.search && window.location.search.includes("jobIds")) {
    let ids = window.location.search.slice(1).split("&").map(v => v.split("="))[0][1].split(",")
    let results = []
    for (let id of ids) {
      console.log(getUrl(`jobs?jobId=${id}`))
      getData(getUrl(`jobs?jobId=${id}`)).then(d => results.push(d))
    }
    (async()=>{await new Promise(r => setTimeout(r, 5000));console.log(results)})()
  }
}

getJobs()