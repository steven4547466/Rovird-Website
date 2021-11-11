async function getJobs() {
  if (window.location.search && window.location.search.includes("jobIds")) {
    let ids = window.location.search.slice(1).split("&").map(v => v.split("="))[0][1].split(",")
    let scripts = document.getElementById("scripts")
    let hoversDone = {}
    for (let id of ids) {
      try {
        let results = await getData(getUrl(`jobs?jobId=${id}`))
        for (let result of results) {
          for (let [uuid, r] of Object.entries(result)) {
            let title = document.createElement("p")
            title.classList.add("title")
            title.style = "text-align: center;"
            title.textContent = r.name
            let text = document.createElement("p")
            let flags = [...new Set(r.flags.map(f => f.line))]
            if (r.flags.length > 0) {
              text.classList.add("flag-text")
              text.textContent = `${r.flags.length} flags (line(s) #${flags.map(t => t ? t : 0).join(", #")})`
            } else {
              text.classList.add("no-flags")
              text.textContent = "No flags"
            }
            let pre = document.createElement("pre")
            pre.id = uuid
            pre.classList.add("line-numbers")
            pre.setAttribute("data-line", flags.filter(l => l).join(","))
            let code = document.createElement("code")
            code.classList.add("language-lua")
            // console.log(r.source)
            code.textContent = r.source
            pre.appendChild(code)
            scripts.appendChild(title)
            scripts.appendChild(text)
            scripts.appendChild(pre)
            if (flags.includes(null)) {
              let div = null
              title.addEventListener("click", (e) => {
                if (div != null) return
                let flags = r.flags.filter(f => f.line == null)
                div = document.createElement("div")
                div.classList.add("is-overlay", "flags")
                div.style = `top:${e.pageY + 50}px; background-color: #343c3d; border-radius: 1em; text-align:center; height: ${flags.length * 22 + 22}px;`
                div.addEventListener("click", () => {
                  div.remove()
                  div = null
                })
                let p = document.createElement("p")
                p.classList.add("flag-line")
                p.textContent = "Flags with no line"
                div.appendChild(p)
                for (let flag of flags) {
                  let p = document.createElement("p")
                  p.classList.add("flag-text")
                  p.textContent = flag.reason
                  div.appendChild(p)
                }
                document.body.appendChild(div)
              })
              title.classList.add("flag-text")
            }
            pre.addEventListener('DOMNodeInserted', function (event) {
              if (!event.target.getAttribute) return
              let line = parseInt(event.target.getAttribute("data-range"))
              if (event.target.parentNode.id === uuid && (!hoversDone[uuid] || !hoversDone[uuid].includes(line))) {
                if (!hoversDone[uuid]) hoversDone[uuid] = []
                hoversDone[uuid].push(line)
                let flags = r.flags.filter(f => f.line == line)
                let div = null
                event.target.addEventListener("click", (e) => {
                  if (div != null) return
                  div = document.createElement("div")
                  div.classList.add("is-overlay", "flags")
                  div.style = `top:${e.pageY + 50}px; background-color: #343c3d; border-radius: 1em; text-align:center; height: ${flags.length * 22 + 22}px;`
                  div.addEventListener("click", () => {
                    div.remove()
                    div = null
                  })
                  let p = document.createElement("p")
                  p.classList.add("flag-line")
                  p.textContent = `Line #${line}`
                  div.appendChild(p)
                  for (let flag of flags) {
                    let p = document.createElement("p")
                    p.classList.add("flag-text")
                    p.textContent = flag.reason
                    div.appendChild(p)
                  }
                  document.body.appendChild(div)
                })
              }
            }, false);
          }
        }
      } catch (e) {
        console.error("Unable to get results for id: " + id)
        console.error(e)
      }
    }
  }
  let script = document.createElement("script")
  script.src = "js/prism.js"
  document.body.appendChild(script)
}

function bodyLoaded() {
  getJobs()
}