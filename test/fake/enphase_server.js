import { createServer } from "node:http"
import { URL } from "node:url"

const server = createServer((req, res) => {
    const url = new URL(req.url, "http://host/")

    // The bootstrap request
    if (url.pathname == "/") {
        res.statusCode = 200
        res.statusMessage = "Ok"
        res.setHeader("Content-Type", "text/html")
        res.write("<html></html>")
    } else if (url.pathname == "/login/login") {
        res.statusCode = 302
        res.statusMessage = "Ok"
        res.setHeader("Location", "/web/12345?v=99999")
    } else if (url.pathname == "/pv/settings/12345/battery_config") {
        res.statusCode = 200
        res.statusMessage = "Ok"
        res.setHeader("Content-Type", "text/json")
        res.write(JSON.stringify({
            battery_config: {
                usage: "backup_only",
            },
        }))
    } else {
        res.statusCode = 404
        res.statusMessage = "Not Found"
    }

    res.end()
})

server.listen(8001)
