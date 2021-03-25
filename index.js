const db = require("quick.db")
const rateLimit = require("express-rate-limit");
const bcrypt = require('bcrypt')
const cookieParser = require('cookie-parser');
const fs = require('graceful-fs')

const express = require("express")
const app = express()

const first = db.get("first")
if(!first || first !== "complete") {
  db.push("urls","https://bruh-uptime.herokuapp.com/")
  db.set("first","complete")
}
require("./ping.js")

app.set('view engine', 'ejs')
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser());

/* REDIRECT HTTP to HTTPS */
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http')
    return res.redirect(301, `https://${req.headers.host}/${req.url}`)

  next();
});

/* API RUN */
fs.readdirSync(__dirname + '/api').forEach(f => require(`./api/${f}`)(app, db));

app.get('/badge', function(req, res) {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.sendFile(__dirname + '/upstatus.svg');
});

/* RENDER INDEX */
app.get("/", async(req, res) => {
  var c = req.cookies.login
  if(!c) {
    return res.render("index", {
      has: db.get("urls").length
    })
  }

  var name =c.split("<")[0];
  var pass =c.split("<")[1];
  var acc = db.get(`account_${name}`)
  var realpass = acc.pass

  if(!acc) {
    return res.redirect("/logout")
  }

  if(pass !== realpass) {
    return res.redirect("/logout")
  }
  if(acc.ban) {
    return res.redirect("/logout")
  }

  var i = db.get("urls")
  var u = db.all().filter(data => data.ID.startsWith(`account`)).sort((a, b) => b.data - a.data)
  var ir = 0;
  var g = "";
  for (ir in u) {
    if(u[ir].ID.split('_')[1] !== process.env.adminname) {
      if(u[ir].data.split(",")[2].split("}")[0].split(":")[1] !== "false") {
        g += `${u[ir].ID.split('_')[1]} <a style="background: transparent;" href="/b?name=${name}&pass=${pass}&user=${u[ir].ID.split('_')[1]}&type=unban">UNBAN</a> | <a style="background: transparent;" href="/b?name=${name}&pass=${pass}&user=${u[ir].ID.split('_')[1]}&type=delete">DELETE</a><br>`;
      } else {
        g += `${u[ir].ID.split('_')[1]} <a style="background: transparent;" href="/b?name=${name}&pass=${pass}&user=${u[ir].ID.split('_')[1]}&type=ban">BAN</a> | <a style="background: transparent;" href="/b?name=${name}&pass=${pass}&user=${u[ir].ID.split('_')[1]}&type=delete">DELETE</a><br>`;
      }
    } else {
      g += `${u[ir].ID.split('_')[1]} | ADMIN<br>`;
    }
  }

  var ur = ""
  i.forEach(function(url) {
    var ugall = url.split("<")[0]
    ur += `${ugall} <a style="background: transparent;" href="/r?name=${name}&pass=${pass}&url=${url}">DELETE</a><br>`
  })

  var urr = ""
  i.forEach(function(url) {
    var ug = url.split("<")[0]
    var nug = url.split("<")[1]

    var status = db.get(`status_${ug}`)
    if(status === undefined || !status) {
      if(name === nug) {
        urr += `${ug} ➜ ⏲️ Please wait 1m to check! | <a style="background: transparent;" href="/r?d=my&pass=${pass}&url=${url}">DELETE</a><br>`
      }
      return;
    }

    var check = {
      true: "✅ Online",
      false: "❌ Offline",
      undefined: "⏲️ Please wait 1m to check!"
    }

    if(name === nug) {
      urr += `${ug} ➜ ${check[status.status]} | <a style="background: transparent;" href="/r?d=my&pass=${pass}&url=${url}">DELETE</a><br>`
    }
  })
  
  var perms;
  if(acc.name === process.env.adminname) {
    perms = true
  } else {
    perms = false
  }

  res.render("dashboard", {
    perms: perms,
    urls: ur,
    has: i.length,
    members: g,
    your: urr
  })
})

/* REGISTER */
const { registerMax , registerMessage } = require("./config.json")

const registerLimit = rateLimit({
  windowMs: 86400000,
  max: registerMax,
  message: registerMessage
});

app.post("/register", registerLimit, async(req, res) => {
  var i = db.get("urls")
  var name = req.body.name
  var pass = req.body.pass
  var acc = db.get(`account_${name}`)

  if(acc) return res.render("error", {
    error: true,
    status: 400,
    error: "Account already exists!"
  }) 

  if(!name) return res.render("error", {
    error: true,
    status: 400,
    error: "Please define name."
  })

  if(!pass) return res.render("error", {
    error: true,
    status: 400,
    error: "Please define pass."
  })

  if(name.includes("<" || ">" || "<script>" || "</script>") || encodeURIComponent(name).includes("%3C" || "%3E")) return res.render("error", {
    error: true,
    status: 400,
    error: "Please use normal characters"
  }) 

  const salt = await bcrypt.genSalt(10)
  const hash = await bcrypt.hash(pass, salt)

  db.set(`account_${name}`, {
    pass: hash,
    name: name,
    ban: false
  })

  if(!acc) return res.render("error", {
    error: false,
    status: 200,
    error: "Account succesfully created!"
  })
})

/* LOGIN */
app.post("/login", async(req, res) => {
  var i = db.get("urls")
  var u = db.all().filter(data => data.ID.startsWith(`account`)).sort((a, b) => b.data - a.data)

  var name = req.body.name
  var pass = req.body.pass
  var acc = db.get(`account_${name}`)

  if(!acc) return res.render("error", {
    error: true,
    status: 400,
    error: "Account not exist"
  })

  var ir = 0;
  var g = "";
  for (ir in u) {
    g += `${u[ir].ID.split('_')[1]} <a style="background: transparent;" href="/b?name=${acc.name}&pass=${acc.pass}&user=${u[ir].ID.split('_')[1]}&type=ban">BAN</a> | <a style="background: transparent;" href="/b?name=${acc.name}&pass=${acc.pass}&user=${u[ir].ID.split('_')[1]}&type=delete">DELETE</a><br>`;
  }

  var ur = ""
  i.forEach(function(url) {
    var ugall = url.split("<")[0]
    ur += `${ugall} <a style="background: transparent;" href="/r?name=${acc.name}&pass=${acc.pass}&url=${url}">DELETE</a><br>`
  })

  var urr = ""
  i.forEach(function(url) {
    var ug = url.split("<")[0]
    var nug = url.split("<")[1]

    var status = db.get(`status_${ug}`)
    if(status === undefined || !status) {
      if(name === nug) {
        urr += `${ug} ➜ ⏲️ Please wait 1m to check! | <a style="background: transparent;" href="/r?d=my&pass=${pass}&url=${url}">DELETE</a><br>`
      }
      return;
    }

    var check = {
      true: "✅ Online",
      false: "❌ Offline",
      undefined: "⏲️ Please wait 1m to check!"
    }

    if(name === nug) {
      urr += `${ug} ➜ ${check[status.status]} | <a style="background: transparent;" href="/r?d=my&pass=${pass}&url=${url}">DELETE</a><br>`
    }
  })

  const salt = await bcrypt.genSalt(10)
  const hash = await bcrypt.hash(pass, salt)

  const match = await bcrypt.compare(pass, acc.pass);

  if(!match) return res.render("error", {
    error: true,
    status: 400,
    error: "Please check password. Password is bad"
  })

  if(acc.ban) return res.render("error", {
    error: true,
    status: 400,
    error: "Your account is disabled :("
  })

  var perms;
  if(acc.name === process.env.adminname) {
    perms = true
  } else {
    perms = false
  }

  res.cookie("login", acc.name + "<" + acc.pass);
  res.render("dashboard", {
    perms: perms,
    urls: ur,
    has: i.length,
    members: g,
    your: urr
  })
})

/* LOGOUT */
app.get("/logout", async(req, res) => {
  res.clearCookie("login");
  res.redirect("/") 
})

/* RESETPASS */
app.get("/resetpass", async(req, res) => {
  var c = req.cookies.login

  if(!c) {
    return res.render("index", {
      has: db.get("urls").length
    })
  }

  var name = c.split("<")[0];
  var pass = c.split("<")[1];

  var acc = db.get(`account_${name}`)
  if(!acc) return res.render("error", {
    error: true,
    status: 400,
    error: "Account not exist"
  })
  if(acc.pass != pass) {
    return res.render("error", {
        error: true,
        status: 400,
        error: "Please check password. Password is bad"
    })
  }

  res.render("resetpass", {
    has: db.get("urls").length
  })
})

/* CREATE */
app.post("/create", async(req, res) => {
  var url = req.body.ur
  var u = db.get("urls")
  var c = req.cookies.login

  if(!c) {
    return res.render("index", {
      has: db.get("urls").length
    })
  }

  var name = c.split("<")[0];
  var pass = c.split("<")[1];

  var acc = db.get(`account_${name}`)
  if(!acc) return res.render("error", {
    error: true,
    status: 400,
    error: "Account not exist"
  })
  if(acc.pass != pass) {
    return res.render("error", {
        error: true,
        status: 400,
        error: "Please check password. Password is bad"
    })
  }

  function isValidUrl(string) {
    try {
      new URL(string);
    } catch (_) {
      return false;  
    }

    return true;
  }

  if(isValidUrl(url) !== true || url.includes("<" || ">" || "<script>" || "</script>") || encodeURIComponent(url).includes("%3C" || "%3E" || "%20")) return res.render("error", {
    error: true,
    status: 400,
    error: "Please check url. Url is not valid"
  }) 

  var ui = [];
  var ur = ""
  u.forEach(function(url) {
    var ugall = url.split("<")[0]
    ui.push(ugall)
  })

  if (ui.indexOf(url) > -1) {
    return res.render("error", {
        error: true,
        status: 400,
        error: "Please check url. Url is already on db"
      })
  }

  db.push("urls",url + "<" + name)
  res.render("error", {
    error: true,
    status: 200,
    error: "URL is succesfully added! ("+url+")"
  })
})

/* BAN USER & REMOVE URL */
app.get("/b", async(req, res) => {
  const acc = db.get(`account_${process.env.adminname}`)

  if(req.query.name !== acc.name) return res.render("error", {
    error: true,
    status: 400,
    error: "Please check name. Name is bad"
  })

  if(!req.query.pass) return res.render("error", {
    error: true,
    status: 400,
    error: "Please define password."
  })

  if(req.query.pass !== acc.pass) return res.render("error", {
    error: true,
    status: 400,
    error: "Please check password. Password is bad"
  })

  if(!req.query.user) return res.render("error", {
    error: true,
    status: 400,
    error: "Please define user."
  })

  var del = db.get(`account_${req.query.user}`)
  if(!del) return res.render("error", {
    error: true,
    status: 400,
    error: "Please check user. User is bad"
  })

  if(req.query.type === "ban") {
    var old = db.get(`account_${req.query.user}`)
    db.set(`account_${req.query.user}`, {
      pass: old.pass,
      name: old.name,
      ban: true
    })

    return res.render("error", {
        error: false,
        status: 200,
        error: "User succesfully banned!"
    })
  }
   if(req.query.type === "unban") {
    var old = db.get(`account_${req.query.user}`)
    db.set(`account_${req.query.user}`, {
      pass: old.pass,
      name: old.name,
      ban: false
    })

    return res.render("error", {
        error: false,
        status: 200,
        error: "User succesfully unbanned!"
    })
  }

  if(req.query.type === "delete") {
    const u = db.get("urls")
    var yurl = []

    u.forEach(function(url) {
      var n = url.split("<")[1]
      if(n === req.query.user) {
        yurl.push(url)
      }
    })

    yurl.forEach(function(url) {
      var array = db.get("urls");
      array = array.filter(v => v !== url);
      db.set("urls", array)
      db.delete(`status_${url.split("<")[0]}`)
    })

    console.log(u)
    db.delete(`account_${req.query.user}`)

    return res.render("error", {
        error: false,
        status: 200,
        error: "User succesfully deleted!"
    })
  }
})

app.get("/r", async(req, res) => {
  if(req.query.d === "my") {
    const acc = db.get(`account_${req.cookies.login.split("<")[0]}`)
    if(!acc) return res.render("error", {
      error: true,
      status: 400,
      error: "Account not exist"
    })

    if(!req.query.pass) return res.render("error", {
      error: true,
      status: 400,
      error: "Please define password."
    })

    if(req.query.pass !== acc.pass) return res.render("error", {
      error: true,
      status: 400,
      error: "Please check password. Password is bad"
    })

    if(!req.query.url) return res.render("error", {
      error: true,
      status: 400,
      error: "Please define url."
    })

    if(!req.query.url.includes("<")) return res.render("error", {
      error: true,
      status: 400,
      error: `Url not includes "<"`
    })

    var ar = []
    if(req.query.url.includes("<")) {
      var my = req.query.url.split("<")[1]
      const u = db.get("urls")

      if(my === acc.name) {
        if (u.indexOf(req.query.url) > -1) {
          var array = db.get("urls");
          array = array.filter(v => v !== req.query.url);
          db.set("urls", array)
          db.delete(`status_${req.query.url.split("<")[0]}`)

          res.render("error", {
              error: false,
              status: 200,
              error: "URL is deleted! (" + req.query.url.split("<")[0] + ")"
          }) 
        return;
        }
      } else {
        return res.render("error", {
            error: true,
            status: 400,
            error: "This url is not added on your account."
        })
      }
    }

    return res.render("error", {
        error: true,
        status: 400,
        error: "Please check url. Url is not on db"
    }) 
  }

  const acc = db.get(`account_${process.env.adminname}`)
  const u = db.get("urls")

  if(req.query.name !== acc.name) return res.render("error", {
    error: true,
    status: 400,
    error: "Please check name. Name is bad"
  })

  if(!req.query.pass) return res.render("error", {
    error: true,
    status: 400,
    error: "Please define password."
  })

  if(req.query.pass !== acc.pass) return res.render("error", {
    error: true,
    status: 400,
    error: "Please check password. Password is bad"
  })

  if(!req.query.url) return res.render("error", {
    error: true,
    status: 400,
    error: "Please define url."
  })

  if (u.indexOf(req.query.url) > -1) {
    var array = db.get("urls");
    array = array.filter(v => v !== req.query.url);
    db.set("urls", array)
    db.delete(`status_${req.query.url.split("<")[0]}`)

    res.render("error", {
        error: false,
        status: 200,
        error: "URL is deleted! (" + req.query.url.split("<")[0] + ")"
    }) 
  return;
  }

  return res.render("error", {
      error: true,
      status: 400,
      error: "Please check url. Url is not on db"
  }) 
})

/* RESET PASS POST */
app.post("/rp", async(req, res) => {
    const acc = db.get(`account_${req.cookies.login.split("<")[0]}`)
    if(!acc) return res.render("error", {
      error: true,
      status: 400,
      error: "Account not exist"
    })

    if(!req.body.oldpass) return res.render("error", {
      error: true,
      status: 400,
      error: "Please define old password."
    })

    if(!req.body.newpass) return res.render("error", {
      error: true,
      status: 400,
      error: "Please define new password."
    })


    const match = await bcrypt.compare(req.body.oldpass, acc.pass);

    if(!match) return res.render("error", {
      error: true,
      status: 400,
      error: "Please check password. Password is bad"
    })

    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(req.body.newpass, salt)

    db.set(`account_${req.cookies.login.split("<")[0]}`, {
      pass: hash,
      name: acc.name,
      ban: acc.ban
    })

    return res.render("error", {
      error: false,
      status: 200,
      error: "Password succesfully changed ("+req.body.newpass+")"
    }) 
})

app.listen(process.env.port || 5000, () => {
  console.log("Website started")
})
