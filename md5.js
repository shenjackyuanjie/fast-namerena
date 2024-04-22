// let document = document;
// let window = window;

'use strict';

let name_input = "!test!\n\natest\n\ntest2";
let assets_data = {
    lang: null,
    gAd: null,
};

let run_env = {
    from_code: (typeof window == "undefined"),
    is_node: (typeof Bun == "undefined"),
    is_bun: (typeof Bun != "undefined"),
};

console.log("run_env", run_env);

let logger = {
    // debug: 只在 from_code 时输出
    debug: function (...msg) {
        if (run_env.from_code) {
            // 上个色
            // let last_stack = new Error().stack;
            // console.log("\x1b[32mlogger<", last_stack, ">:", ...msg, "\x1b[0m")
            console.log("\x1b[32mlogger:", ...msg, "\x1b[0m")
        }
    },
    info: function (...msg) {
        console.log("logger: ", msg)
    }
}

if (run_env.from_code) {
    console.log("Running from code");

    // 整一套虚拟的window和document
    // 但说实话十分生草

    // list of elements
    let stored_elements = [];

    global.window = {
        sessionStorage: function () { },
        localStorage: function () { },
    };

    class fake_class_list {
        constructor() {
            this.datas = []
        };
        add(data) {
            this.datas.push(data)
        };
        contains(data) {
            return this.datas.includes(data)
        };
        item(index) {
            if (index >= this.datas.length) {
                let stack = new Error().stack;
                logger.info("fake_class_list.item", stack);
                return null
            }
            return this.datas[index]
        };
    }

    class fake_element {
        constructor(tag) {
            this.childList = [];
            this.tag = tag;
            this.width = 0;
            this.height = 0;
            this.style = {};
            this.classList = new fake_class_list();
            this.styleSheets = [
                "something"
            ];
            this.length = 0;
            this.innerHTML = "";
            // 把自己加到列表里
            stored_elements.push(this);
        };
        querySelector(tag) {
            // 搜索一下有没有这个元素
            for (let i = 0; i < this.childList.length; i++) {
                if (this.childList[i].tag == tag) {
                    return this.childList[i];
                }
            }
        };
        appendChild(element) {
            this.childList.push(element);
        };
        addEventListener() { };
    }

    global.document = {
        createElement: function (tag) {
            // return fake_element.fake_init(tag);
            return new fake_element(tag);
        },
        createTextNode: function (data) {
            let node = new fake_element("text");
            node.innerHTML = data;
            return node;
        },
        querySelector: function (tag) {
            // 搜索一下有没有这个元素
            logger.debug("querySelector", tag);
            for (let i = 0; i < stored_elements.length; i++) {
                if (stored_elements[i].tag == tag) {
                    return stored_elements[i];
                }
            }
        },
        body: new fake_element("body"),
        styleSheets: [{
            "some": "thing"
        }],
    };

    let fake_plist = document.createElement(".plist");
    let fake_pbody = document.createElement(".pbody");
    logger.debug(stored_elements)

    global.self = global.window;

    // 读取文件
    let fs = require("fs");
    let path = require("path");
    let assets_path = path.join(__dirname, "assets");

    // 加载 zh.json
    let lang_path = path.join(assets_path, "zh.json");
    let lang_data = fs.readFileSync(lang_path, "utf-8");

    // 加载 gAd.md
    let gAd_path = path.join(assets_path, "gAd.md");
    let gAd_data = fs.readFileSync(gAd_path, "utf-8");

    assets_data.lang = lang_data;
    assets_data.gAd = gAd_data;
}

let why_ns = 0;

function copyProperties(a, b) {
    var s = Object.keys(a)
    for (var r = 0; r < s.length; r++) {
        var q = s[r]
        b[q] = a[q]
    }
}

function mixinProperties(a, b) {
    var s = Object.keys(a)
    for (var r = 0; r < s.length; r++) {
        var q = s[r]
        if (!b.hasOwnProperty(q)) b[q] = a[q]
    }
}

function inherit(a, b) {
    a.prototype.constructor = a
    a.prototype["$i" + a.name] = a
    if (b != null) {
        a.prototype.__proto__ = b.prototype
        return
    }
}

function inheritMany(a, b) {
    for (var s = 0; s < b.length; s++) inherit(b[s], a)
}

function mixin(a, b) {
    mixinProperties(b.prototype, a.prototype)
    a.prototype.constructor = a
}

function lazyOld(a, b, c, d) {
    var s = a
    a[b] = s
    a[c] = function () {
        a[c] = function () {
            H.throwCyclicInit(b)
        }
        var r
        var q = d
        try {
            if (a[b] === s) {
                r = a[b] = q
                r = a[b] = d()
            } else r = a[b]
        } finally {
            if (r === q) a[b] = null
            a[c] = function () {
                return this[b]
            }
        }
        return r
    }
}

function lazy(a, b, c, d) {
    var s = a
    a[b] = s
    a[c] = function () {
        if (a[b] === s) a[b] = d()
        a[c] = function () {
            return this[b]
        }
        return a[b]
    }
}

function lazyFinal(a, b, c, d) {
    var s = a
    a[b] = s
    a[c] = function () {
        if (a[b] === s) {
            var r = d()
            if (a[b] !== s) H.vm(b)
            a[b] = r
        }
        a[c] = function () {
            return this[b]
        }
        return a[b]
    }
}

function makeConstList(a) {
    a.immutable$list = Array
    a.fixed$length = Array
    return a
}

var y = 0

function instanceTearOffGetter(a, b) {
    var s = b.fs[0]
    if (a) return new Function("parameters, createTearOffClass, cache", "return function tearOff_" + s + y++ + "(receiver) {" + "if (cache === null) cache = createTearOffClass(parameters);" + "return new cache(receiver, this);" + "}")(b, H.mx, null)
    else return new Function("parameters, createTearOffClass, cache", "return function tearOff_" + s + y++ + "() {" + "if (cache === null) cache = createTearOffClass(parameters);" + "return new cache(this, null);" + "}")(b, H.mx, null)
}

function staticTearOffGetter(a) {
    var s = null
    return function () {
        if (s === null) s = H.mx(a).prototype
        return s
    }
}
var x = 0

function tearOffParameters(a, b, c, d, e, f, g, h, i, j) {
    if (typeof h == "number") h += x
    return {
        co: a,
        iS: b,
        iI: c,
        rC: d,
        dV: e,
        cs: f,
        fs: g,
        fT: h,
        aI: i || 0,
        nDA: j
    }
}

function installStaticTearOff(a, b, c, d, e, f, g, h) {
    var s = tearOffParameters(a, true, false, c, d, e, f, g, h, false)
    var r = staticTearOffGetter(s)
    a[b] = r
}

function installInstanceTearOff(a, b, c, d, e, f, g, h, i, j) {
    c = !!c
    var s = tearOffParameters(a, false, c, d, e, f, g, h, i, !!j)
    var r = instanceTearOffGetter(c, s)
    a[b] = r
}

function setOrUpdateInterceptorsByTag(a) {
    var s = init.interceptorsByTag
    if (!s) {
        init.interceptorsByTag = a
        return
    }
    copyProperties(a, s)
}

function setOrUpdateLeafTags(a) {
    var s = init.leafTags
    if (!s) {
        init.leafTags = a
        return
    }
    copyProperties(a, s)
}

function updateTypes(a) {
    var s = init.types
    var r = s.length
    s.push.apply(s, a)
    return r
}

function updateHolder(a, b) {
    copyProperties(b, a)
    return a
}
var hunkHelpers = function () {
    var s = function (a, b, c, d, e) {
        return function (f, g, h, i) {
            return installInstanceTearOff(f, g, a, b, c, d, [h], i, e, false)
        }
    },
        r = function (a, b, c, d) {
            return function (e, f, g, h) {
                return installStaticTearOff(e, f, a, b, c, [g], h, d)
            }
        }
    return {
        inherit: inherit,
        inheritMany: inheritMany,
        mixin: mixin,
        installStaticTearOff: installStaticTearOff,
        installInstanceTearOff: installInstanceTearOff,
        _instance_0u: s(0, 0, null, ["$0"], 0),
        _instance_1u: s(0, 1, null, ["$1"], 0),
        _instance_2u: s(0, 2, null, ["$2"], 0),
        _instance_0i: s(1, 0, null, ["$0"], 0),
        _instance_1i: s(1, 1, null, ["$1"], 0),
        _instance_2i: s(1, 2, null, ["$2"], 0),
        _static_0: r(0, null, ["$0"], 0),
        _static_1: r(1, null, ["$1"], 0),
        _static_2: r(2, null, ["$2"], 0),
        makeConstList: makeConstList,
        lazy: lazy,
        lazyFinal: lazyFinal,
        lazyOld: lazyOld,
        updateHolder: updateHolder,
        updateTypes: updateTypes,
        setOrUpdateInterceptorsByTag: setOrUpdateInterceptorsByTag,
        setOrUpdateLeafTags: setOrUpdateLeafTags
    }
}()

var A = {
    eR(a) {
        var s = window.localStorage,
            r = LangData.eQ("i")
        s.setItem(r, a)
        s = $.nx()
        r = s.b
        if (r >= 4) H.throw_expression(s.ee())
        if ((r & 1) !== 0) s.cc(a)
        else if ((r & 3) === 0) s.en().j(0, new P.er(a))
    },
    vo(a) {
        var s = $.nx()
        s.toString
        new P.cM(s, H._instanceType(s).i("cM<1>")).f4(a)
        return
    }
},
    C = {},
    Sgls = {
        o6(a) {
            var s, r, q
            if ($.k8.J(0, a)) return $.k8.h(0, a)
            s = $.e_
            $.e_ = s + 1
            r = "icon_" + s
            $.k8.m(0, a, r)
            q = Sgls.tt(a).toDataURL("image/png", null)
            $.mg.m(0, a, q)
            t.w.a(C.v.gbl(document.styleSheets)).insertRule("div." + r + ' { background-image:url("' + H.as_string(q) + '"); }', $.e_ - 1)
            return r
        },
        tw() {
            $.rW.aw(0, new Sgls.k7())
        },
        tv(a) {
            var s, r, q, p, o, n, m, l, k, j, i, h, g, f = W.j4()
            f.width = 128
            f.height = 128
            f.getContext("2d").drawImage($.md, 0, 0)
            s = J.cm(P.my(f.getContext("2d").getImageData(0, 0, 128, 128)))
            for (r = t.i, q = 0; q < 38; ++q) {
                p = C.JsInt.V(q, 8) * 64 + C.JsInt.ag(q, 8) * 8192
                o = H.b([], r)
                for (n = 0; n < 16; ++n)
                    for (m = n * 512, l = 0; l < 16; ++l) {
                        k = p + l * 4 + m
                        j = s[k]
                        if (j > s[k + 1]) o.push(j)
                        else o.push(0)
                    }
                $.dZ.push(o)
            }
            for (q = 0; q < 8; ++q) {
                p = q * 64 + 57344
                i = H.b([], r)
                h = H.b([], r)
                for (n = 0; n < 16; ++n)
                    for (m = n * 512, l = 0; l < 16; ++l) {
                        k = p + l * 4 + m
                        j = s[k]
                        g = k + 1
                        if (j > s[g]) i.push(j)
                        else i.push(0)
                        j = s[g]
                        if (j > s[k + 2]) h.push(255 - j)
                        else h.push(255)
                    }
                $.me.push(i)
                $.o5.push(h)
            }
            $.nt().bM(0, "")
        },
        tt(a) {
            var s, r, q = new LangData.SuperRC4()
            q.bd(LangData.fZ(a), 2)
            s = q.c
            s.toString
            r = H._arrayInstanceType(s).i("y<1,l*>")
            return Sgls.ts(P.List_List_of(new H.y(s, new Sgls.k5(), r), true, r.i("M.E")))
        },
        ts(a) {
            var s, r, q, p, o, n, m, l, k, j, i, h, g, f = C.d.V(a[0], $.me.length),
                e = t.i,
                d = H.b([], e)
            d.push(C.d.V(a[1], $.dZ.length))
            s = a[2]
            r = $.dZ.length
            q = C.d.V(s, r)
            if (q === d[0]) {
                q = C.d.V(a[3], r)
                p = 4
            } else p = 3
            d.push(q)
            o = p + 1
            if (a[p] < 4) {
                p = o + 1
                d.push(C.d.V(a[o], $.dZ.length))
                o = p + 1
                if (a[p] < 64) {
                    p = o + 1
                    d.push(C.d.V(a[o], $.dZ.length))
                } else p = o
            } else p = o
            n = $.nu().getContext("2d")
            o = p + 1
            m = C.d.V(a[p], $.d7() - 6)
            l = $.mf[m]
            s = l[0]
            r = l[1]
            k = l[2]
            n.toString
            n.fillStyle = "rgba(" + s + ", " + r + ", " + k + ", 1)"
            n.fillRect(1, 1, 14, 14)
            j = H.b([], e)
            i = new Sgls.k6(j, m, d)
            for (p = o, h = 0; h < d.length; ++h) {
                o = p + 1
                g = C.d.V(a[p], $.d7())
                for (p = o; !i.$1(g); p = o) {
                    o = p + 1
                    g = C.d.V(a[p], $.d7())
                }
                j.push(g)
                Sgls.o4(n, $.dZ[d[h]], $.mf[g])
            }
            Sgls.tu(n, f)
            return $.nu()
        },
        o4(a, b, c) {
            var s, r, q, p, o
            for (s = 0, r = 0, q = 0; q < 16; ++q)
                for (p = 0; p < 16; ++p) {
                    o = r + 3
                    if (b[s] > 0) {
                        J.cm($.d8())[r] = c[0]
                        J.cm($.d8())[r + 1] = c[1]
                        J.cm($.d8())[r + 2] = c[2]
                        J.cm($.d8())[o] = b[s]
                    } else J.cm($.d8())[o] = 0;
                    ++s
                    r += 4
                }
            o = $.lS().getContext("2d");
            (o && C.k).dw(o, $.d8(), 0, 0)
            a.drawImage($.lS(), 0, 0)
        },
        tu(a, b) {
            var s, r, q, p
            Sgls.o4(a, $.me[b], H.b([64, 64, 64], t.i))
            s = P.my(a.getImageData(0, 0, 16, 16))
            r = $.o5[b]
            for (q = J.bv(s), p = 0; p < 256; ++p) q.gck(s)[p * 4 + 3] = r[p]
            C.k.dw(a, s, 0, 0)
        },
        k7: function k7() { },
        k4: function k4() { },
        k5: function k5() { },
        k6: function k6(a, b, c) {
            this.a = a
            this.b = b
            this.c = c
        },
        c: function c(a) {
            var _ = this
            _.a = 0
            _.c = _.b = null
            _.$ti = a
        },
        a_: function a_(a, b, c) {
            var _ = this
            _.a = a
            _.b = null
            _.c = b
            _.$ti = c
        },
        n: function n() { }
    },
    H = {
        m8: function m8() { },
        ls(a, b, c) {
            if (a == null) throw H.wrap_expression(new H.dO(b, c.i("dO<0>")))
            return a
        },
        t5(a, b, c, d) {
            if (t.gw.b(a)) return new H.dr(a, b, c.i("@<0>").aL(d).i("dr<1,2>"))
            return new H.c6(a, b, c.i("@<0>").aL(d).i("c6<1,2>"))
        },
        fu() {
            return new P.bJ("No element")
        },
        rY() {
            return new P.bJ("Too many elements")
        },
        tJ(a, b) {
            // H.hL(a, 0, J.aw(a) - 1, b)
            H.hL(a, 0, a.length - 1, b)
        },
        hL(a, b, c, d) {
            if (c - b <= 32) H.ej(a, b, c, d)
            else H.ei(a, b, c, d)
        },
        ej(a, b, c, d) {
            var s, r, q, p, o
            for (s = b + 1, r = J.a3(a); s <= c; ++s) {
                q = r.h(a, s)
                p = s
                while (true) {
                    if (!(p > b && d.$2(r.h(a, p - 1), q) > 0)) break
                    o = p - 1
                    r.m(a, p, r.h(a, o))
                    p = o
                }
                r.m(a, p, q)
            }
        },
        ei(a3, a4, a5, a6) {
            var s, r, q, p, o, n, m, l, k, j, i = C.JsInt.ag(a5 - a4 + 1, 6),
                h = a4 + i,
                g = a5 - i,
                f = C.JsInt.ag(a4 + a5, 2),
                e = f - i,
                d = f + i,
                c = J.a3(a3),
                b = c.h(a3, h),
                a = c.h(a3, e),
                a0 = c.h(a3, f),
                a1 = c.h(a3, d),
                a2 = c.h(a3, g)
            if (a6.$2(b, a) > 0) {
                s = a
                a = b
                b = s
            }
            if (a6.$2(a1, a2) > 0) {
                s = a2
                a2 = a1
                a1 = s
            }
            if (a6.$2(b, a0) > 0) {
                s = a0
                a0 = b
                b = s
            }
            if (a6.$2(a, a0) > 0) {
                s = a0
                a0 = a
                a = s
            }
            if (a6.$2(b, a1) > 0) {
                s = a1
                a1 = b
                b = s
            }
            if (a6.$2(a0, a1) > 0) {
                s = a1
                a1 = a0
                a0 = s
            }
            if (a6.$2(a, a2) > 0) {
                s = a2
                a2 = a
                a = s
            }
            if (a6.$2(a, a0) > 0) {
                s = a0
                a0 = a
                a = s
            }
            if (a6.$2(a1, a2) > 0) {
                s = a2
                a2 = a1
                a1 = s
            }
            c.m(a3, h, b)
            c.m(a3, f, a0)
            c.m(a3, g, a2)
            c.m(a3, e, c.h(a3, a4))
            c.m(a3, d, c.h(a3, a5))
            r = a4 + 1
            q = a5 - 1
            // if (J.Y(a6.$2(a, a1), 0)) {
            if (a6.$2(a, a1) === 0) {
                for (p = r; p <= q; ++p) {
                    o = c.h(a3, p)
                    n = a6.$2(o, a)
                    if (n === 0) continue
                    if (n < 0) {
                        if (p !== r) {
                            c.m(a3, p, c.h(a3, r))
                            c.m(a3, r, o)
                        } ++r
                    } else
                        for (; true;) {
                            n = a6.$2(c.h(a3, q), a)
                            if (n > 0) {
                                --q
                                continue
                            } else {
                                m = q - 1
                                if (n < 0) {
                                    c.m(a3, p, c.h(a3, r))
                                    l = r + 1
                                    c.m(a3, r, c.h(a3, q))
                                    c.m(a3, q, o)
                                    q = m
                                    r = l
                                    break
                                } else {
                                    c.m(a3, p, c.h(a3, q))
                                    c.m(a3, q, o)
                                    q = m
                                    break
                                }
                            }
                        }
                }
                k = true
            } else {
                for (p = r; p <= q; ++p) {
                    o = c.h(a3, p)
                    if (a6.$2(o, a) < 0) {
                        if (p !== r) {
                            c.m(a3, p, c.h(a3, r))
                            c.m(a3, r, o)
                        } ++r
                    } else if (a6.$2(o, a1) > 0)
                        for (; true;)
                            if (a6.$2(c.h(a3, q), a1) > 0) {
                                --q
                                if (q < p) break
                                continue
                            } else {
                                m = q - 1
                                if (a6.$2(c.h(a3, q), a) < 0) {
                                    c.m(a3, p, c.h(a3, r))
                                    l = r + 1
                                    c.m(a3, r, c.h(a3, q))
                                    c.m(a3, q, o)
                                    r = l
                                } else {
                                    c.m(a3, p, c.h(a3, q))
                                    c.m(a3, q, o)
                                }
                                q = m
                                break
                            }
                }
                k = false
            }
            j = r - 1
            c.m(a3, a4, c.h(a3, j))
            c.m(a3, j, a)
            j = q + 1
            c.m(a3, a5, c.h(a3, j))
            c.m(a3, j, a1)
            H.hL(a3, a4, r - 2, a6)
            H.hL(a3, q + 2, a5, a6)
            if (k) return
            if (r < h && q > g) {
                // for (; J.Y(a6.$2(c.h(a3, r), a), 0);) {
                for (; a6.$2(c.h(a3, r), a) === 0;) {
                    ++r
                }
                // for (; J.Y(a6.$2(c.h(a3, q), a1), 0);) {
                for (; a6.$2(c.h(a3, q), a1) === 0;) {
                    --q
                }
                for (p = r; p <= q; ++p) {
                    o = c.h(a3, p)
                    if (a6.$2(o, a) === 0) {
                        if (p !== r) {
                            c.m(a3, p, c.h(a3, r))
                            c.m(a3, r, o)
                        } ++r
                    } else if (a6.$2(o, a1) === 0)
                        for (; true;)
                            if (a6.$2(c.h(a3, q), a1) === 0) {
                                --q
                                if (q < p) break
                                continue
                            } else {
                                m = q - 1
                                if (a6.$2(c.h(a3, q), a) < 0) {
                                    c.m(a3, p, c.h(a3, r))
                                    l = r + 1
                                    c.m(a3, r, c.h(a3, q))
                                    c.m(a3, q, o)
                                    r = l
                                } else {
                                    c.m(a3, p, c.h(a3, q))
                                    c.m(a3, q, o)
                                }
                                q = m
                                break
                            }
                }
                H.hL(a3, r, q, a6)
            } else H.hL(a3, r, q, a6)
        },
        fz: function fz(a) {
            this.a = a
        },
        ff: function ff(a) {
            this.a = a
        },
        dO: function dO(a, b) {
            this.a = a
            this.$ti = b
        },
        A: function A() { },
        M: function M() { },
        cv: function cv(a, b) {
            var _ = this
            _.a = a
            _.b = b
            _.c = 0
            _.d = null
        },
        c6: function c6(a, b, c) {
            this.a = a
            this.b = b
            this.$ti = c
        },
        dr: function dr(a, b, c) {
            this.a = a
            this.b = b
            this.$ti = c
        },
        fB: function fB(a, b) {
            this.a = null
            this.b = a
            this.c = b
        },
        y: function y(a, b, c) {
            this.a = a
            this.b = b
            this.$ti = c
        },
        cf: function cf(a, b, c) {
            this.a = a
            this.b = b
            this.$ti = c
        },
        hX: function hX(a, b) {
            this.a = a
            this.b = b
        },
        du: function du() { },
        hV: function hV() { },
        cJ: function cJ() { },
        a9: function a9(a, b) {
            this.a = a
            this.$ti = b
        },
        oP(a) {
            var s, r = init.mangledGlobalNames[a]
            if (r != null) return r
            s = "minified:" + a
            return s
        },
        oG(a, b) {
            var s
            if (b != null) {
                s = b.x
                if (s != null) return s
            }
            return t.aU.b(a)
        },
        as_string(a) {
            var res
            if (typeof a == "string") {
                return a
            }
            if (typeof a == "number") {
                if (a !== 0) {
                    return "" + a
                }
            } else if (true === a) {
                return "true"
            } else if (false === a) {
                return "false"
            } else if (a == null) {
                return "null"
            }
            res = J.b4(a)
            if (typeof res != "string") throw H.wrap_expression(H.R(a))
            return res
        },
        Primitives_objectHashCode(a) {
            var s = a.$identityHash
            if (s == null) {
                s = Math.random() * 0x3fffffff | 0
                a.$identityHash = s
            }
            return s
        },
        tk(a, b) {
            var s, r
            if (typeof a != "string") H.throw_expression(H.R(a))
            s = /^\s*[+-]?((0x[a-f0-9]+)|(\d+)|([a-z0-9]+))\s*$/i.exec(a)
            if (s == null) return null
            r = s[3]
            if (r != null) return parseInt(a, 10)
            if (s[2] != null) return parseInt(a, 16)
            return null
        },
        jZ(a) {
            return H.tc(a)
        },
        tc(a) {
            var s, r, q, p
            if (a instanceof P.Object) return H.aH(H.instanceType(a), null)
            if (J.cV(a) === C.J || t.bI.b(a)) {
                s = C.p(a)
                r = s !== "Object" && s !== ""
                if (r) return s
                q = a.constructor
                if (typeof q == "function") {
                    p = q.name
                    if (typeof p == "string") r = p !== "Object" && p !== ""
                    else r = false
                    if (r) return p
                }
            }
            return H.aH(H.instanceType(a), null)
        },
        nY(a) {
            var s, r, q, p, o = a.length
            if (o <= 500) return String.fromCharCode.apply(null, a)
            for (s = "", r = 0; r < o; r = q) {
                q = r + 500
                p = q < o ? q : o
                s += String.fromCharCode.apply(null, a.slice(r, p))
            }
            return s
        },
        tl(a) {
            var s, r, q, p = H.b([], t.dC)
            for (s = a.length, r = 0; r < a.length; a.length === s || (0, H.F)(a), ++r) {
                q = a[r]
                if (!H.aP(q)) throw H.wrap_expression(H.R(q))
                if (q <= 65535) p.push(q)
                else if (q <= 1114111) {
                    p.push(55296 + (C.JsInt.am(q - 65536, 10) & 1023))
                    p.push(56320 + (q & 1023))
                } else throw H.wrap_expression(H.R(q))
            }
            return H.nY(p)
        },
        nZ(a) {
            var s, r, q
            for (s = a.length, r = 0; r < s; ++r) {
                q = a[r]
                if (!H.aP(q)) throw H.wrap_expression(H.R(q))
                if (q < 0) throw H.wrap_expression(H.R(q))
                if (q > 65535) return H.tl(a)
            }
            return H.nY(a)
        },
        tm(a, b, c) {
            var s, r, q, p
            if (c <= 500 && b === 0 && c === a.length) return String.fromCharCode.apply(null, a)
            for (s = b, r = ""; s < c; s = q) {
                q = s + 500
                p = q < c ? q : c
                r += String.fromCharCode.apply(null, a.subarray(s, p))
            }
            return r
        },
        cC(a) {
            var s
            if (a <= 65535) return String.fromCharCode(a)
            if (a <= 1114111) {
                s = a - 65536
                return String.fromCharCode((C.JsInt.am(s, 10) | 55296) >>> 0, s & 1023 | 56320)
            }
            throw H.wrap_expression(P.a8(a, 0, 1114111, null, null))
        },
        aG(a) {
            if (a.date === void 0) a.date = new Date(a.a)
            return a.date
        },
        tj(a) {
            return a.b ? H.aG(a).getUTCFullYear() + 0 : H.aG(a).getFullYear() + 0
        },
        th(a) {
            return a.b ? H.aG(a).getUTCMonth() + 1 : H.aG(a).getMonth() + 1
        },
        td(a) {
            return a.b ? H.aG(a).getUTCDate() + 0 : H.aG(a).getDate() + 0
        },
        te(a) {
            return a.b ? H.aG(a).getUTCHours() + 0 : H.aG(a).getHours() + 0
        },
        tg(a) {
            return a.b ? H.aG(a).getUTCMinutes() + 0 : H.aG(a).getMinutes() + 0
        },
        ti(a) {
            return a.b ? H.aG(a).getUTCSeconds() + 0 : H.aG(a).getSeconds() + 0
        },
        tf(a) {
            return a.b ? H.aG(a).getUTCMilliseconds() + 0 : H.aG(a).getMilliseconds() + 0
        },
        bQ(a, b) {
            var s, r = "index"
            if (!H.aP(b)) return new P.aS(true, b, r, null)
            // s = J.aw(a)
            s = a.length
            if (b < 0 || b >= s) return P.ft(b, a, r, null, s)
            return P.k0(b, r)
        },
        uP(a, b, c) {
            if (a > c) return P.a8(a, 0, c, "start", null)
            if (b != null)
                if (b < a || b > c) return P.a8(b, a, c, "end", null)
            return new P.aS(true, b, "end", null)
        },
        R(a) {
            return new P.aS(true, a, null, null)
        },
        ar(a) {
            if (typeof a != "number") throw H.wrap_expression(H.R(a))
            return a
        },
        wrap_expression(a) {
            var s, r
            if (a == null) a = new P.fL()
            s = new Error()
            s.dartException = a
            r = H.vn
            if ("defineProperty" in Object) {
                Object.defineProperty(s, "message", {
                    get: r
                })
                s.name = ""
            } else s.toString = r
            return s
        },
        vn() {
            return J.b4(this.dartException)
        },
        throw_expression(a) {
            throw H.wrap_expression(a)
        },
        F(a) {
            throw H.wrap_expression(P.aK(a))
        },
        br(a) {
            var s, r, q, p, o, n
            a = H.quoteStringForRegExp(a.replace(String({}), "$receiver$"))
            s = a.match(/\\\$[a-zA-Z]+\\\$/g)
            if (s == null) s = H.b([], t.s)
            r = s.indexOf("\\$arguments\\$")
            q = s.indexOf("\\$argumentsExpr\\$")
            p = s.indexOf("\\$expr\\$")
            o = s.indexOf("\\$method\\$")
            n = s.indexOf("\\$receiver\\$")
            return new H.kh(a.replace(new RegExp("\\\\\\$arguments\\\\\\$", "g"), "((?:x|[^x])*)").replace(new RegExp("\\\\\\$argumentsExpr\\\\\\$", "g"), "((?:x|[^x])*)").replace(new RegExp("\\\\\\$expr\\\\\\$", "g"), "((?:x|[^x])*)").replace(new RegExp("\\\\\\$method\\\\\\$", "g"), "((?:x|[^x])*)").replace(new RegExp("\\\\\\$receiver\\\\\\$", "g"), "((?:x|[^x])*)"), r, q, p, o, n)
        },
        ki(a) {
            return function ($expr$) {
                var $argumentsExpr$ = "$arguments$"
                try {
                    $expr$.$method$($argumentsExpr$)
                } catch (s) {
                    return s.message
                }
            }(a)
        },
        o8(a) {
            return function ($expr$) {
                try {
                    $expr$.$method$
                } catch (s) {
                    return s.message
                }
            }(a)
        },
        m9(a, b) {
            var s = b == null,
                r = s ? null : b.method
            return new H.fx(a, r, s ? null : b.receiver)
        },
        unwrap_Exception(a) {
            if (a == null) return new H.jR(a)
            if (a instanceof H.dt) return H.saveStackTrace(a, a.a)
            if (typeof a !== "object") return a
            if ("dartException" in a) return H.saveStackTrace(a, a.dartException)
            return H._unwrapNonDartException(a)
        },
        saveStackTrace(ex, err) {
            if (t.u.b(err))
                if (err.$thrownJsError == null) err.$thrownJsError = ex
            return err
        },
        _unwrapNonDartException(ex) {
            var s, r, q, t1, nsme, not_closure, null_call, l, k, j, i, h, g, match, e = null
            if (!("message" in ex)) return ex
            s = ex.message
            if ("number" in ex && typeof ex.number == "number") {
                r = ex.number
                q = r & 65535
                if ((C.JsInt.am(r, 16) & 8191) === 10) switch (q) {
                    case 438:
                        return H.saveStackTrace(ex, H.m9(H.as_string(s) + " (Error " + q + ")", e))
                    case 445:
                    case 5007:
                        t1 = H.as_string(s) + " (Error " + q + ")"
                        return H.saveStackTrace(ex, new H.NullError(t1, e))
                }
            }
            if (ex instanceof TypeError) {
                nsme = $.r7()
                not_closure = $.r8()
                null_call = $.r9()
                l = $.ra()
                k = $.rd()
                j = $.re()
                i = $.rc()
                $.rb()
                h = $.rg()
                g = $.rf()
                match = nsme.aH(s)
                if (match != null) return H.saveStackTrace(ex, H.m9(s, match))
                else {
                    match = not_closure.aH(s)
                    if (match != null) {
                        match.method = "call"
                        return H.saveStackTrace(ex, H.m9(s, match))
                    } else {
                        match = null_call.aH(s)
                        if (match == null) {
                            match = l.aH(s)
                            if (match == null) {
                                match = k.aH(s)
                                if (match == null) {
                                    match = j.aH(s)
                                    if (match == null) {
                                        match = i.aH(s)
                                        if (match == null) {
                                            match = l.aH(s)
                                            if (match == null) {
                                                match = h.aH(s)
                                                if (match == null) {
                                                    match = g.aH(s)
                                                    t1 = match != null
                                                } else t1 = true
                                            } else t1 = true
                                        } else t1 = true
                                    } else t1 = true
                                } else t1 = true
                            } else t1 = true
                        } else t1 = true
                        if (t1) {
                            return H.saveStackTrace(ex, new H.NullError(s, match == null ? e : match.method))
                        }
                    }
                }
                return H.saveStackTrace(ex, new H.hU(typeof s == "string" ? s : ""))
            }
            if (ex instanceof RangeError) {
                if (typeof s == "string" && s.indexOf("call stack") !== -1) return new P.el()
                s = function (b) {
                    try {
                        return String(b)
                    } catch (d) { }
                    return null
                }(ex)
                return H.saveStackTrace(ex, new P.aS(false, e, e, typeof s == "string" ? s.replace(/^RangeError:\s*/, "") : s))
            }
            if (typeof InternalError == "function" && ex instanceof InternalError)
                if (typeof s == "string" && s === "too much recursion") return new P.el()
            return ex
        },
        getTraceFromException(a) {
            var s
            if (a instanceof H.dt) return a.b
            if (a == null) return new H.eE(a)
            s = a.$cachedTrace
            if (s != null) return s
            return a.$cachedTrace = new H.eE(a)
        },
        vd(a) {
            if (a == null || typeof a != "object") return J.lZ(a)
            else return H.Primitives_objectHashCode(a)
        },
        uQ(a, b) {
            var s, r, q, p = a.length
            for (s = 0; s < p; s = q) {
                r = s + 1
                q = r + 1
                b.m(0, a[s], a[r])
            }
            return b
        },
        invokeClosure(closure, numberOfArguments, arg1, arg2, arg3, arg4) {
            switch (numberOfArguments) {
                case 0:
                    return closure.$0()
                case 1:
                    return closure.$1(arg1)
                case 2:
                    return closure.$2(arg1, arg2)
                case 3:
                    return closure.$3(arg1, arg2, arg3)
                case 4:
                    return closure.$4(arg1, arg2, arg3, arg4)
            }
            throw H.wrap_expression(new P.kG("Unsupported number of arguments for wrapped closure"))
        },
        // MARK: convert_dart_closure_to_js_md5
        // convertDartClosureToJS
        convert_dart_closure_to_js_md5(closure, arity) {
            var func
            if (closure == null) return null
            func = closure.$identity
            // if (!!s) return s
            if (func) return func
            func = function (closure_, arity_, invoker) {
                return function (arg1, arg2, arg3, arg4) {
                    return invoker(closure_, arity_, arg1, arg2, arg3, arg4)
                }
            }(closure, arity, H.invokeClosure)
            closure.$identity = func
            return func
        },
        Closure_fromTearOff(a2) {
            var s, r, q, p, o, n, m, l, k, j, i = a2.co,
                h = a2.iS,
                g = a2.iI,
                f = a2.nDA,
                e = a2.aI,
                d = a2.fs,
                c = a2.cs,
                b = d[0],
                a = c[0],
                a0 = i[b],
                a1 = a2.fT
            a1.toString
            s = h ? Object.create(new H.kc().constructor.prototype) : Object.create(new H.dg(null, null).constructor.prototype)
            s.$initialize = s.constructor
            if (h) r = function static_tear_off() {
                this.$initialize()
            }
            else {
                q = $.bk
                $.bk = q + 1
                q = new Function("a,b" + q, "this.$initialize(a,b" + q + ")")
                r = q
            }
            s.constructor = r
            r.prototype = s
            s.$_name = b
            s.$_target = a0
            q = !h
            if (q) p = H.Closure_forwardCallTo(b, a0, g, f)
            else {
                s.$static_name = b
                p = a0
            }
            s.$S = H.Closure__computeSignatureFunctionNewRti(a1, h, g)
            s[a] = p
            for (o = p, n = 1; n < d.length; ++n) {
                m = d[n]
                if (typeof m == "string") {
                    l = i[m]
                    k = m
                    m = l
                } else k = ""
                j = c[n]
                if (j != null) {
                    if (q) m = H.Closure_forwardCallTo(k, m, g, f)
                    s[j] = m
                }
                if (n === e) o = m
            }
            s.$C = o
            s.$R = a2.rC
            s.$D = a2.dV
            return r
        },
        Closure__computeSignatureFunctionNewRti(a, b, c) {
            if (typeof a == "number") return a
            if (typeof a == "string") {
                if (b) throw H.wrap_expression("Cannot compute signature for static tearoff.")
                return function (d, e) {
                    return function () {
                        return e(this, d)
                    }
                }(a, H.rF)
            }
            throw H.wrap_expression("Error in functionType of tearoff")
        },
        Closure_cspForwardCall(arity, is_super_call, stub_name, func) {
            var get_self = H.BoundClosure_selfOf
            switch (is_super_call ? -1 : arity) {
                case 0:
                    return function (e, f) {
                        return function () {
                            return f(this)[e]()
                        }
                    }(stub_name, get_self)
                case 1:
                    return function (e, f) {
                        return function (g) {
                            return f(this)[e](g)
                        }
                    }(stub_name, get_self)
                case 2:
                    return function (e, f) {
                        return function (g, h) {
                            return f(this)[e](g, h)
                        }
                    }(stub_name, get_self)
                case 3:
                    return function (e, f) {
                        return function (g, h, i) {
                            return f(this)[e](g, h, i)
                        }
                    }(stub_name, get_self)
                case 4:
                    return function (e, f) {
                        return function (g, h, i, j) {
                            return f(this)[e](g, h, i, j)
                        }
                    }(stub_name, get_self)
                case 5:
                    return function (e, f) {
                        return function (g, h, i, j, k) {
                            return f(this)[e](g, h, i, j, k)
                        }
                    }(stub_name, get_self)
                default:
                    return function (e, f) {
                        return function () {
                            return e.apply(f(this), arguments)
                        }
                    }(func, get_self)
            }
        },
        Closure_forwardCallTo(a, b, c, d) {
            var s, r, q, p, o, n = "receiver"
            if (c) return H.Closure_forwardInterceptedCallTo(a, b, d)
            s = b.length
            r = d || s >= 27
            if (r) return H.Closure_cspForwardCall(s, d, a, b)
            if (s === 0) {
                r = $.bk
                $.bk = r + 1
                q = "self" + H.as_string(r)
                r = "return function(){var " + q + " = this."
                p = $.dh
                return new Function(r + (p == null ? $.dh = H.j3(n) : p) + ";return " + q + "." + H.as_string(a) + "();}")()
            }
            o = "abcdefghijklmnopqrstuvwxyz".split("").splice(0, s).join(",")
            r = $.bk
            $.bk = r + 1
            o += H.as_string(r)
            r = "return function(" + o + "){return this."
            p = $.dh
            return new Function(r + (p == null ? $.dh = H.j3(n) : p) + "." + H.as_string(a) + "(" + o + ");}")()
        },
        Closure_cspForwardInterceptedCall(arity, is_super_call, name, func) {
            var get_self = H.BoundClosure_selfOf,
                get_receiver = H.BoundClosure_receiverOf
            switch (is_super_call ? -1 : arity) {
                case 0:
                    throw H.wrap_expression(new H.h3("Intercepted function with no arguments."))
                case 1:
                    return function (e, f, g) {
                        return function () {
                            return f(this)[e](g(this))
                        }
                    }(name, get_receiver, get_self)
                case 2:
                    return function (e, f, g) {
                        return function (h) {
                            return f(this)[e](g(this), h)
                        }
                    }(name, get_receiver, get_self)
                case 3:
                    return function (e, f, g) {
                        return function (h, i) {
                            return f(this)[e](g(this), h, i)
                        }
                    }(name, get_receiver, get_self)
                case 4:
                    return function (e, f, g) {
                        return function (h, i, j) {
                            return f(this)[e](g(this), h, i, j)
                        }
                    }(name, get_receiver, get_self)
                case 5:
                    return function (e, f, g) {
                        return function (h, i, j, k) {
                            return f(this)[e](g(this), h, i, j, k)
                        }
                    }(name, get_receiver, get_self)
                case 6:
                    return function (e, f, g) {
                        return function (h, i, j, k, l) {
                            return f(this)[e](g(this), h, i, j, k, l)
                        }
                    }(name, get_receiver, get_self)
                default:
                    return function (e, f, g) {
                        return function () {
                            var q = [g(this)]
                            Array.prototype.push.apply(q, arguments)
                            return e.apply(f(this), q)
                        }
                    }(func, get_receiver, get_self)
            }
        },
        Closure_forwardInterceptedCallTo(a, b, c) {
            var s, r, q, p, o, n = $.nE
            if (n == null) n = $.nE = H.j3("interceptor")
            s = $.dh
            if (s == null) s = $.dh = H.j3("receiver")
            r = b.length
            q = c || r >= 28
            if (q) return H.Closure_cspForwardInterceptedCall(r, c, a, b)
            if (r === 1) {
                q = "return function(){return this." + n + "." + H.as_string(a) + "(this." + s + ");"
                p = $.bk
                $.bk = p + 1
                return new Function(q + H.as_string(p) + "}")()
            }
            o = "abcdefghijklmnopqrstuvwxyz".split("").splice(0, r - 1).join(",")
            q = "return function(" + o + "){return this." + n + "." + H.as_string(a) + "(this." + s + ", " + o + ");"
            p = $.bk
            $.bk = p + 1
            return new Function(q + H.as_string(p) + "}")()
        },
        mx(a) {
            // 理论上不能改, 但是似乎可以
            // 上面是因为这玩意在普通版里是用来拼接的, 但是这里似乎没用于拼接
            return H.Closure_fromTearOff(a)
        },
        rF(a, b) {
            // BoundClosure_evalRecipe
            // or
            // BoundClosure_evalRecipeIntercepted
            return H._Universe_evalInEnvironment(init.typeUniverse, H.instanceType(a.a), b)
        },
        BoundClosure_selfOf(a) {
            return a.a
        },
        BoundClosure_receiverOf(a) {
            return a.b
        },
        j3(a) {
            var s, r, q, p = new H.dg("receiver", "interceptor"),
                o = J.nL(Object.getOwnPropertyNames(p))
            for (s = o.length, r = 0; r < s; ++r) {
                q = o[r]
                if (p[q] === a) return q
            }
            throw H.wrap_expression(P.bz("Field name " + a + " not found.", null))
        },
        throwCyclicInit(a) {
            throw H.wrap_expression(new P.fj(a))
        },
        getIsolateAffinityTag(a) {
            return init.getIsolateTag(a)
        },
        defineProperty(a, b, c) {
            // 笑死, 根本没人用
            Object.defineProperty(a, b, {
                value: c,
                enumerable: false,
                writable: true,
                configurable: true
            })
        },
        lookupAndCacheInterceptor(obj) {
            var s, r, q, p, o, n = $.oB.$1(obj),
                m = $.lt[n]
            if (m != null) {
                Object.defineProperty(obj, init.dispatchPropertyName, {
                    value: m,
                    enumerable: false,
                    writable: true,
                    configurable: true
                })
                return m.i
            }
            s = $.ly[n]
            if (s != null) return s
            r = init.interceptorsByTag[n]
            if (r == null) {
                q = $.ov.$2(obj, n)
                if (q != null) {
                    m = $.lt[q]
                    if (m != null) {
                        Object.defineProperty(obj, init.dispatchPropertyName, {
                            value: m,
                            enumerable: false,
                            writable: true,
                            configurable: true
                        })
                        return m.i
                    }
                    s = $.ly[q]
                    if (s != null) return s
                    r = init.interceptorsByTag[q]
                    n = q
                }
            }
            if (r == null) return null
            s = r.prototype
            p = n[0]
            if (p === "!") {
                m = H.makeLeafDispatchRecord(s)
                $.lt[n] = m
                Object.defineProperty(obj, init.dispatchPropertyName, {
                    value: m,
                    enumerable: false,
                    writable: true,
                    configurable: true
                })
                return m.i
            }
            if (p === "~") {
                $.ly[n] = s
                return s
            }
            if (p === "-") {
                o = H.makeLeafDispatchRecord(s)
                Object.defineProperty(Object.getPrototypeOf(obj), init.dispatchPropertyName, {
                    value: o,
                    enumerable: false,
                    writable: true,
                    configurable: true
                })
                return o.i
            }
            if (p === "+") return H.patchInteriorProto(obj, s)
            if (p === "*") throw H.wrap_expression(P.hT(n))
            if (init.leafTags[n] === true) {
                o = H.makeLeafDispatchRecord(s)
                Object.defineProperty(Object.getPrototypeOf(obj), init.dispatchPropertyName, {
                    value: o,
                    enumerable: false,
                    writable: true,
                    configurable: true
                })
                return o.i
            } else return H.patchInteriorProto(obj, s)
        },
        patchInteriorProto(a, b) {
            var s = Object.getPrototypeOf(a)
            Object.defineProperty(s, init.dispatchPropertyName, {
                value: J.makeDispatchRecord(b, s, null, null),
                enumerable: false,
                writable: true,
                configurable: true
            })
            return b
        },
        makeLeafDispatchRecord(a) {
            return J.makeDispatchRecord(a, false, null, !!a.$iag)
        },
        makeDefaultDispatchRecord(a, b, c) {
            var s = b.prototype
            if (init.leafTags[a] === true) return H.makeLeafDispatchRecord(s)
            else return J.makeDispatchRecord(s, c, null, null)
        },
        initNativeDispatch() {
            if (true === $.mA) return
            $.mA = true
            if (!run_env.from_code) {
                H.initNativeDispatchContinue()
            }
        },
        initNativeDispatchContinue() {
            var s, r, q, p, o, n, m, l
            $.lt = Object.create(null)
            $.ly = Object.create(null)
            H.initHooks()
            s = init.interceptorsByTag
            r = Object.getOwnPropertyNames(s)
            // 检测是否在网页内运行
            if (typeof window != "undefined") {
                window
                q = function () { }
                for (p = 0; p < r.length; ++p) {
                    o = r[p]
                    n = $.oL.$1(o)
                    if (n != null) {
                        m = H.makeDefaultDispatchRecord(o, s[o], n)
                        if (m != null) {
                            Object.defineProperty(n, init.dispatchPropertyName, {
                                value: m,
                                enumerable: false,
                                writable: true,
                                configurable: true
                            })
                            q.prototype = n
                        }
                    }
                }
            }
            for (p = 0; p < r.length; ++p) {
                o = r[p]
                if (/^[A-Za-z_]/.test(o)) {
                    l = s[o]
                    s["!" + o] = l
                    s["~" + o] = l
                    s["-" + o] = l
                    s["+" + o] = l
                    s["*" + o] = l
                }
            }
        },
        initHooks() {
            var p, o, n, m = C.w()

            p = m.getTag
            o = m.getUnknownTag
            n = m.prototypeForTag
            $.oB = new H.lv(p)
            $.ov = new H.lw(o)
            $.oL = new H.lx(n)
        },
        // 笑死了, 我把所有调用删掉了(在之前的commit)
        // applyHooksTransformer(transformer, hooks) {
        //     return transformer(hooks) || hooks
        // },
        JSSyntaxRegExp_makeNative(source, multiline, case_sensitive, unicode, dot_all, global) {
            var s = multiline ? "m" : "",
                r = case_sensitive ? "" : "i",
                q = unicode ? "u" : "",
                p = dot_all ? "s" : "",
                o = global ? "g" : "",
                regex_xp = function (source, modifiers) {
                    try {
                        return new RegExp(source, modifiers)
                    } catch (e) {
                        return e
                    }
                }(source, s + r + q + p + o)
            if (regex_xp instanceof RegExp)
                return regex_xp
            throw H.wrap_expression(P.FormatException("Illegal RegExp pattern (" + String(regex_xp) + ")", source, null))
        },
        iF(a, b, c) {
            var s
            if (typeof b == "string") return a.indexOf(b, c) >= 0
            else {
                s = J.lU(b, C.String.ay(a, c))
                s = s.gbv(s)
                return !s
            }
        },
        oz(a) {
            if (a.indexOf("$", 0) >= 0) return a.replace(/\$/g, "$$$$")
            return a
        },
        vk(a, b, c, d) {
            var s = b.d_(a, d)
            if (s == null) return a
            return H.mG(a, s.b.index, s.gbh(), c)
        },
        quoteStringForRegExp(a) {
            if (/[[\]{}()*+?.\\^$|]/.test(a)) return a.replace(/[[\]{}()*+?.\\^$|]/g, "\\$&")
            return a
        },
        mF(a, b, c) {
            var s = H.vj(a, b, c)
            return s
        },
        vj(a, b, c) {
            var s, r, q, p
            if (b === "") {
                if (a === "") return c
                s = a.length
                for (r = c, q = 0; q < s; ++q) r = r + a[q] + c
                return r.charCodeAt(0) == 0 ? r : r
            }
            p = a.indexOf(b, 0)
            if (p < 0) return a
            if (a.length < 500 || c.indexOf("$", 0) >= 0) return a.split(b).join(c)
            return a.replace(new RegExp(H.quoteStringForRegExp(b), "g"), H.oz(c))
        },
        mv(a) {
            return a
        },
        oO(a, b, c, d) {
            var s, r, q, p
            if (typeof b == "string") return H.vi(a, b, c, H.uv())
            if (!t.eh.b(b)) throw H.wrap_expression(P.da(b, "pattern", "is not a Pattern"))
            for (s = J.lU(b, a), s = s.ga0(s), r = 0, q = ""; s.u();) {
                p = s.gC()
                q = q + H.as_string(H.mv(C.String.af(a, r, p.gbc(p)))) + H.as_string(c.$1(p))
                r = p.gbh()
            }
            s = q + H.as_string(H.mv(C.String.ay(a, r)))
            return s.charCodeAt(0) == 0 ? s : s
        },
        vh(a, b, c) {
            var s, r, q = a.length,
                p = H.as_string(c.$1(""))
            for (s = 0; s < q;) {
                p += H.as_string(b.$1(new H.bK(s, "")))
                if ((C.String.a8(a, s) & 4294966272) === 55296 && q > s + 1)
                    if ((C.String.a8(a, s + 1) & 4294966272) === 56320) {
                        r = s + 2
                        p += H.as_string(c.$1(C.String.af(a, s, r)))
                        s = r
                        continue
                    } p += H.as_string(c.$1(a[s]));
                ++s
            }
            p = p + H.as_string(b.$1(new H.bK(s, ""))) + H.as_string(c.$1(""))
            return p.charCodeAt(0) == 0 ? p : p
        },
        vi(a, b, c, d) {
            var s, r, q, p, o = b.length
            if (o === 0) return H.vh(a, c, d)
            s = a.length
            for (r = 0, q = ""; r < s;) {
                p = a.indexOf(b, r)
                if (p === -1) break
                q = q + H.as_string(d.$1(C.String.af(a, r, p))) + H.as_string(c.$1(new H.bK(p, b)))
                r = p + o
            }
            q += H.as_string(d.$1(C.String.ay(a, r)))
            return q.charCodeAt(0) == 0 ? q : q
        },
        iG(a, b, c, d) {
            var s, r, q, p, o, n
            if (typeof b == "string") {
                s = a.indexOf(b, d)
                if (s < 0) return a
                return H.mG(a, s, s + b.length, c)
            }
            if (b instanceof H.JSSyntaxRegExp) return d === 0 ? a.replace(b.b, H.oz(c)) : H.vk(a, b, c, d)
            if (b == null) H.throw_expression(H.R(b))
            r = J.rt(b, a, d)
            q = r.ga0(r)
            if (!q.u()) return a
            p = q.gC()
            r = p.gbc(p)
            o = p.gbh()
            n = P.cE(r, o, a.length)
            return H.mG(a, r, n, c)
        },
        mG(a, b, c, d) {
            var s = a.substring(0, b),
                r = a.substring(c)
            return s + d + r
        },
        kh: function kh(a, b, c, d, e, f) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.e = e
            _.f = f
        },
        NullError: function dP(a, b) {
            this.a = a
            this.b = b
        },
        fx: function fx(a, b, c) {
            this.a = a
            this.b = b
            this.c = c
        },
        hU: function hU(a) {
            this.a = a
        },
        jR: function jR(a) {
            this.a = a
        },
        dt: function dt(a, b) {
            this.a = a
            this.b = b
        },
        eE: function eE(a) {
            this.a = a
            this.b = null
        },
        c_: function c_() { },
        j5: function j5() { },
        j6: function j6() { },
        kg: function kg() { },
        kc: function kc() { },
        dg: function dg(a, b) {
            this.a = a
            this.b = b
        },
        h3: function h3(a) {
            this.a = a
        },
        aT: function aT(a) {
            var _ = this
            _.a = 0
            _.f = _.e = _.d = _.c = _.b = null
            _.r = 0
            _.$ti = a
        },
        jH: function jH(a) {
            this.a = a
        },
        jK: function jK(a, b) {
            var _ = this
            _.a = a
            _.b = b
            _.d = _.c = null
        },
        dC: function dC(a, b) {
            this.a = a
            this.$ti = b
        },
        fA: function fA(a, b) {
            var _ = this
            _.a = a
            _.b = b
            _.d = _.c = null
        },
        lv: function lv(a) {
            this.a = a
        },
        lw: function lw(a) {
            this.a = a
        },
        lx: function lx(a) {
            this.a = a
        },
        JSSyntaxRegExp: function ct(a, b) {
            var _ = this
            _.a = a
            _.b = b
            _.d = _.c = null
        },
        ew: function ew(a) {
            this.b = a
        },
        hZ: function hZ(a, b, c) {
            this.a = a
            this.b = b
            this.c = c
        },
        kz: function kz(a, b, c) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = null
        },
        bK: function bK(a, b) {
            this.a = a
            this.c = b
        },
        ip: function ip(a, b, c) {
            this.a = a
            this.b = b
            this.c = c
        },
        l3: function l3(a, b, c) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = null
        },
        mq(a, b, c) {
            if (!H.aP(b)) throw H.wrap_expression(P.bz("Invalid view offsetInBytes " + H.as_string(b), null))
        },
        on(a) {
            return a
        },
        fJ(a, b, c) {
            var s
            H.mq(a, b, c)
            s = new Uint8Array(a, b)
            return s
        },
        _checkValidIndex(index, list, len) {
            if (index >>> 0 !== index || index >= len) throw H.wrap_expression(H.bQ(list, index))
        },
        ug(a, b, c) {
            var s
            if (!(a >>> 0 !== a)) s = b >>> 0 !== b || a > b || b > c
            else s = true
            if (s) throw H.wrap_expression(H.uP(a, b, c))
            return b
        },
        dJ: function dJ() { },
        ab: function ab() { },
        NativeTypedArray: function cw() { },
        NativeTypedArrayOfDouble: function c9() { },
        NativeTypedArrayOfInt: function dK() { },
        fE: function fE() { },
        fF: function fF() { },
        fG: function fG() { },
        fH: function fH() { },
        fI: function fI() { },
        dL: function dL() { },
        cx: function cx() { },
        _NativeTypedArrayOfDouble_NativeTypedArray_ListMixin: function ey() { },
        _NativeTypedArrayOfDouble_NativeTypedArray_ListMixin_FixedLengthListMixin: function ez() { },
        _NativeTypedArrayOfInt_NativeTypedArray_ListMixin: function eA() { },
        _NativeTypedArrayOfInt_NativeTypedArray_ListMixin_FixedLengthListMixin: function eB() { },
        Rti__getQuestionFromStar(a, b) {
            var s = b.c
            return s == null ? b.c = H._Universe__lookupQuestionRti(a, b.z, true) : s
        },
        Rti__getFutureFromFutureOr(a, b) {
            var s = b.c
            return s == null ? b.c = H._Universe__lookupInterfaceRti(a, "bl", [b.z]) : s
        },
        Rti__isUnionOfFunctionType(a) {
            var s = a.y
            if (s === 6 || s === 7 || s === 8) return H.Rti__isUnionOfFunctionType(a.z)
            return s === 11 || s === 12
        },
        Rti__getCanonicalRecipe(a) {
            return a.cy
        },
        findType(a) {
            return H._Universe_addErasedTypes(init.typeUniverse, a, false)
        },
        _substitute(a, b, a0, a1) {
            var s, r, q, p, o, n, m, l, k, j, i, h, g, f, e, d, c = b.y
            switch (c) {
                case 5:
                case 1:
                case 2:
                case 3:
                case 4:
                    return b
                case 6:
                    s = b.z
                    r = H._substitute(a, s, a0, a1)
                    if (r === s) return b
                    return H._Universe__lookupStarRti(a, r, true)
                case 7:
                    s = b.z
                    r = H._substitute(a, s, a0, a1)
                    if (r === s) return b
                    return H._Universe__lookupQuestionRti(a, r, true)
                case 8:
                    s = b.z
                    r = H._substitute(a, s, a0, a1)
                    if (r === s) return b
                    return H._Universe__lookupFutureOrRti(a, r, true)
                case 9:
                    q = b.Q
                    p = H._substituteArray(a, q, a0, a1)
                    if (p === q) return b
                    return H._Universe__lookupInterfaceRti(a, b.z, p)
                case 10:
                    o = b.z
                    n = H._substitute(a, o, a0, a1)
                    m = b.Q
                    l = H._substituteArray(a, m, a0, a1)
                    if (n === o && l === m) return b
                    return H._Universe__lookupBindingRti(a, n, l)
                case 11:
                    k = b.z
                    j = H._substitute(a, k, a0, a1)
                    i = b.Q
                    h = H._substituteFunctionParameters(a, i, a0, a1)
                    if (j === k && h === i) return b
                    return H._Universe__lookupFunctionRti(a, j, h)
                case 12:
                    g = b.Q
                    a1 += g.length
                    f = H._substituteArray(a, g, a0, a1)
                    o = b.z
                    n = H._substitute(a, o, a0, a1)
                    if (f === g && n === o) return b
                    return H._Universe__lookupGenericFunctionRti(a, n, f, true)
                case 13:
                    e = b.z
                    if (e < a1) return b
                    d = a0[e - a1]
                    if (d == null) return b
                    return d
                default:
                    throw H.wrap_expression(P.iP("Attempted to substitute unexpected RTI kind " + c))
            }
        },
        _substituteArray(a, b, c, d) {
            var s, r, q, p, o = b.length,
                n = H.ld(o)
            for (s = false, r = 0; r < o; ++r) {
                q = b[r]
                p = H._substitute(a, q, c, d)
                if (p !== q) s = true
                n[r] = p
            }
            return s ? n : b
        },
        _substituteNamed(a, b, c, d) {
            var s, r, q, p, o, n, m = b.length,
                l = H.ld(m)
            for (s = false, r = 0; r < m; r += 3) {
                q = b[r]
                p = b[r + 1]
                o = b[r + 2]
                n = H._substitute(a, o, c, d)
                if (n !== o) s = true
                l.splice(r, 3, q, p, n)
            }
            return s ? l : b
        },
        _substituteFunctionParameters(a, b, c, d) {
            var s, r = b.a,
                q = H._substituteArray(a, r, c, d),
                p = b.b,
                o = H._substituteArray(a, p, c, d),
                n = b.c,
                m = H._substituteNamed(a, n, c, d)
            if (q === r && o === p && m === n) return b
            s = new H.ib()
            s.a = q
            s.b = o
            s.c = m
            return s
        },
        b(a, b) {
            a[init.arrayRti] = b
            return a
        },
        closureFunctionType(a) {
            var s = a.$S
            if (s != null) {
                if (typeof s == "number") return H.uU(s)
                return a.$S()
            }
            return null
        },
        instanceOrFunctionType(a, b) {
            var s
            if (H.Rti__isUnionOfFunctionType(b))
                if (a instanceof H.c_) {
                    s = H.closureFunctionType(a)
                    if (s != null) return s
                } return H.instanceType(a)
        },
        instanceType(a) {
            var s
            if (a instanceof P.Object) {
                s = a.$ti
                return s != null ? s : H._instanceTypeFromConstructor(a)
            }
            if (Array.isArray(a)) return H._arrayInstanceType(a)
            return H._instanceTypeFromConstructor(J.cV(a))
        },
        _arrayInstanceType(a) {
            var s = a[init.arrayRti],
                r = t.gn
            if (s == null) return r
            if (s.constructor !== r.constructor) return r
            return s
        },
        _instanceType(a) {
            var s = a.$ti
            return s != null ? s : H._instanceTypeFromConstructor(a)
        },
        _instanceTypeFromConstructor(a) {
            var s = a.constructor,
                r = s.$ccache
            if (r != null) return r
            return H._instanceTypeFromConstructorMiss(a, s)
        },
        _instanceTypeFromConstructorMiss(a, b) {
            var s = a instanceof H.c_ ? a.__proto__.__proto__.constructor : b,
                r = H.u9(init.typeUniverse, s.name)
            b.$ccache = r
            return r
        },
        uU(a) {
            var s, r = init.types,
                q = r[a]
            if (typeof q == "string") {
                s = H._Universe_addErasedTypes(init.typeUniverse, q, false)
                r[a] = s
                return s
            }
            return q
        },
        mz(a) {
            var s, r, q, p = a.x
            if (p != null) return p
            s = a.cy
            r = s.replace(/\*/g, "")
            if (r === s) return a.x = new H.iu(a)
            q = H._Universe_addErasedTypes(init.typeUniverse, r, true)
            p = q.x
            return a.x = p == null ? q.x = new H.iu(q) : p
        },
        vp(a) {
            return H.mz(H._Universe_addErasedTypes(init.typeUniverse, a, false))
        },
        ul(a) {
            var s, r, q, p = this,
                o = t.K
            if (p === o) return H.cQ(p, a, H.uq)
            if (!H.isStrongTopType(p))
                if (!(p === t.c)) o = p === o
                else o = true
            else o = true
            if (o) return H.cQ(p, a, H.ut)
            o = p.y
            s = o === 6 ? p.z : p
            if (s === t.ci) r = H.aP
            else if (s === t.gR || s === t.di) r = H.up
            else if (s === t.N) r = H.ur
            else r = s === t.y ? H.lm : null
            if (r != null) return H.cQ(p, a, r)
            if (s.y === 9) {
                q = s.z
                if (s.Q.every(H.v0)) {
                    p.r = "$i" + q
                    if (q === "w") return H.cQ(p, a, H.uo)
                    return H.cQ(p, a, H.us)
                }
            } else if (o === 7) return H.cQ(p, a, H.uj)
            return H.cQ(p, a, H.uh)
        },
        cQ(a, b, c) {
            a.b = c
            return a.b(b)
        },
        uk(a) {
            var s, r, this_ = this
            if (!H.isStrongTopType(this_)) {
                if (!(this_ === t.c)) {
                    s = this_ === t.K
                    logger.debug("进入 H.uk")
                } else {
                    s = true
                }
            } else {
                s = true
            }
            logger.debug("进入 H.uk")
            if (s) {
                r = H.ue
            } else {
                if (this_ === t.K) {
                    r = H.ud
                } else {
                    r = H.ui
                }
            }
            logger.debug("进入 H.uk")
            this_.a = r
            // logger.debug("进入 H.uk", r, r(a))
            return this_.a(a)
        },
        ln(a) {
            var t1, r = a.y
            if (!H.isStrongTopType(a))
                if (!(a === t.c))
                    if (!(a === t.aw))
                        if (r !== 7) t1 = r === 8 && H.ln(a.z) || a === t.P || a === t.T
                        else t1 = true
                    else t1 = true
                else t1 = true
            else t1 = true
            return t1
        },
        uh(a) {
            var s = this
            if (a == null) return H.ln(s)
            return H._isSubtype(init.typeUniverse, H.instanceOrFunctionType(a, s), null, s, null)
        },
        uj(a) {
            if (a == null) return true
            return this.z.b(a)
        },
        us(a) {
            var s, r = this
            if (a == null) return H.ln(r)
            s = r.r
            if (a instanceof P.Object) return !!a[s]
            return !!J.cV(a)[s]
        },
        uo(a) {
            var s, r = this
            if (a == null) return H.ln(r)
            if (typeof a != "object") return false
            if (Array.isArray(a)) return true
            s = r.r
            if (a instanceof P.Object) return !!a[s]
            return !!J.cV(a)[s]
        },
        Au(a) {
            var s = this
            if (a == null) return a
            else if (s.b(a)) return a
            H.oo(a, s)
        },
        ui(a) {
            var s = this
            if (a == null) return a
            // set run time info
            else if (s.b(a)) return a
            logger.debug("faild nullable as check", a)
            H.oo(a, s)
        },
        oo(a, b) {
            throw H.wrap_expression(H.u_(H.ob(a, H.instanceOrFunctionType(a, b), H.aH(b, null))))
        },
        ob(a, b, c) {
            var s = P.jh(a),
                r = H.aH(b == null ? H.instanceType(a) : b, null)
            return s + ": type '" + H.as_string(r) + "' is not a subtype of type '" + H.as_string(c) + "'"
        },
        u_(a) {
            return new H.eI("TypeError: " + a)
        },
        aC(a, b) {
            return new H.eI("TypeError: " + H.ob(a, null, b))
        },
        uq(a) {
            return a != null
        },
        ud(a) {
            return a
        },
        ut(a) {
            return true
        },
        ue(a) {
            return a
        },
        lm(a) {
            return true === a || false === a
        },
        Ag(a) {
            if (true === a) return true
            if (false === a) return false
            throw H.wrap_expression(H.aC(a, "bool"))
        },
        Ai(a) {
            if (true === a) return true
            if (false === a) return false
            if (a == null) return a
            throw H.wrap_expression(H.aC(a, "bool"))
        },
        Ah(a) {
            if (true === a) return true
            if (false === a) return false
            if (a == null) return a
            throw H.wrap_expression(H.aC(a, "bool?"))
        },
        Aj(a) {
            if (typeof a == "number") return a
            throw H.wrap_expression(H.aC(a, "double"))
        },
        Al(a) {
            if (typeof a == "number") return a
            if (a == null) return a
            throw H.wrap_expression(H.aC(a, "double"))
        },
        Ak(a) {
            if (typeof a == "number") return a
            if (a == null) return a
            throw H.wrap_expression(H.aC(a, "double?"))
        },
        aP(a) {
            return typeof a == "number" && Math.floor(a) === a
        },
        Am(a) {
            if (typeof a == "number" && Math.floor(a) === a) return a
            throw H.wrap_expression(H.aC(a, "int"))
        },
        Ao(a) {
            if (typeof a == "number" && Math.floor(a) === a) return a
            if (a == null) return a
            throw H.wrap_expression(H.aC(a, "int"))
        },
        An(a) {
            if (typeof a == "number" && Math.floor(a) === a) return a
            if (a == null) return a
            throw H.wrap_expression(H.aC(a, "int?"))
        },
        up(a) {
            return typeof a == "number"
        },
        Ap(a) {
            if (typeof a == "number") return a
            throw H.wrap_expression(H.aC(a, "num"))
        },
        Ar(a) {
            if (typeof a == "number") return a
            if (a == null) return a
            throw H.wrap_expression(H.aC(a, "num"))
        },
        Aq(a) {
            if (typeof a == "number") return a
            if (a == null) return a
            throw H.wrap_expression(H.aC(a, "num?"))
        },
        ur(a) {
            return typeof a == "string"
        },
        As(a) {
            if (typeof a == "string") return a
            throw H.wrap_expression(H.aC(a, "String"))
        },
        lg(a) {
            if (typeof a == "string") return a
            if (a == null) return a
            throw H.wrap_expression(H.aC(a, "String"))
        },
        At(a) {
            if (typeof a == "string") return a
            if (a == null) return a
            throw H.wrap_expression(H.aC(a, "String?"))
        },
        uB(a, b) {
            var s, r, q
            for (s = "", r = "", q = 0; q < a.length; ++q, r = ", ") s += C.String.B(r, H.aH(a[q], b))
            return s
        },
        op(a4, a5, a6) {
            var s, r, q, p, o, n, m, l, k, j, i, h, g, f, e, d, c, b, a, a0, a1, a2, a3 = ", "
            if (a6 != null) {
                s = a6.length
                if (a5 == null) {
                    a5 = H.b([], t.s)
                    r = null
                } else r = a5.length
                q = a5.length
                for (p = s; p > 0; --p) a5.push("T" + (q + p))
                for (o = t.cK, n = t.c, m = t.K, l = "<", k = "", p = 0; p < s; ++p, k = a3) {
                    l = C.String.B(l + k, a5[a5.length - 1 - p])
                    j = a6[p]
                    i = j.y
                    if (!(i === 2 || i === 3 || i === 4 || i === 5 || j === o))
                        if (!(j === n)) h = j === m
                        else h = true
                    else h = true
                    if (!h) l += C.String.B(" extends ", H.aH(j, a5))
                }
                l += ">"
            } else {
                l = ""
                r = null
            }
            o = a4.z
            g = a4.Q
            f = g.a
            e = f.length
            d = g.b
            c = d.length
            b = g.c
            a = b.length
            a0 = H.aH(o, a5)
            for (a1 = "", a2 = "", p = 0; p < e; ++p, a2 = a3) a1 += C.String.B(a2, H.aH(f[p], a5))
            if (c > 0) {
                a1 += a2 + "["
                for (a2 = "", p = 0; p < c; ++p, a2 = a3) a1 += C.String.B(a2, H.aH(d[p], a5))
                a1 += "]"
            }
            if (a > 0) {
                a1 += a2 + "{"
                for (a2 = "", p = 0; p < a; p += 3, a2 = a3) {
                    a1 += a2
                    if (b[p + 1]) a1 += "required "
                    a1 += J.iN(H.aH(b[p + 2], a5), " ") + b[p]
                }
                a1 += "}"
            }
            if (r != null) {
                a5.toString
                a5.length = r
            }
            return l + "(" + a1 + ") => " + H.as_string(a0)
        },
        aH(a, b) {
            var s, r, q, p, o, n, m = a.y
            if (m === 5) return "erased"
            if (m === 2) return "dynamic"
            if (m === 3) return "void"
            if (m === 1) return "Never"
            if (m === 4) return "any"
            if (m === 6) {
                s = H.aH(a.z, b)
                return s
            }
            if (m === 7) {
                r = a.z
                s = H.aH(r, b)
                q = r.y
                return J.iN(q === 11 || q === 12 ? C.String.B("(", s) + ")" : s, "?")
            }
            if (m === 8) return "FutureOr<" + H.as_string(H.aH(a.z, b)) + ">"
            if (m === 9) {
                p = H.uG(a.z)
                o = a.Q
                return o.length > 0 ? p + ("<" + H.uB(o, b) + ">") : p
            }
            if (m === 11) return H.op(a, b, null)
            if (m === 12) return H.op(a.z, b, a.Q)
            if (m === 13) {
                b.toString
                n = a.z
                return b[b.length - 1 - n]
            }
            return "?"
        },
        uG(a) {
            var s, r = init.mangledGlobalNames[a]
            if (r != null) return r
            s = "minified:" + a
            return s
        },
        ua(a, b) {
            var s = a.tR[b]
            for (; typeof s == "string";) s = a.tR[s]
            return s
        },
        u9(universe, b) {
            var s, r, q, p, o, n = universe.eT,
                m = n[b]
            if (m == null) return H._Universe_addErasedTypes(universe, b, false)
            else if (typeof m == "number") {
                s = m
                r = H._Universe__lookupTerminalRti(universe, 5, "#")
                q = H.ld(s)
                for (p = 0; p < s; ++p) q[p] = r
                o = H._Universe__lookupInterfaceRti(universe, b, q)
                n[b] = o
                return o
            } else return m
        },
        _Universe_addRules(universe, b) {
            return H.ol(universe.tR, b)
        },
        _Universe_addErasedTypes(universe, b) {
            return H.ol(universe.eT, b)
        },
        _Universe_addErasedTypes(universe, b, c) {
            var s, r = universe.eC,
                q = r.get(b)
            if (q != null) return q
            s = H._Parser_parse(H.oe(universe, null, b, c))
            r.set(b, s)
            return s
        },
        _Universe_evalInEnvironment(universe, b, c) {
            var s, r, q = b.ch
            if (q == null) q = b.ch = new Map()
            s = q.get(c)
            if (s != null) return s
            r = H._Parser_parse(H.oe(universe, b, c, true))
            q.set(c, r)
            return r
        },
        _Universe_bind(universe, b, c) {
            var s, r, q, p = b.cx
            if (p == null) p = b.cx = new Map()
            s = c.cy
            r = p.get(s)
            if (r != null) return r
            q = H._Universe__lookupBindingRti(universe, b, c.y === 10 ? c.Q : [c])
            p.set(s, q)
            return q
        },
        _Universe__installTypeTests(a, b) {
            b.a = H.uk
            b.b = H.ul
            return b
        },
        _Universe__lookupTerminalRti(a, b, c) {
            var s, r, q = a.eC.get(c)
            if (q != null) return q
            s = new H.Rti(null, null)
            s.y = b
            s.cy = c
            r = H._Universe__installTypeTests(a, s)
            a.eC.set(c, r)
            return r
        },
        _Universe__lookupStarRti(a, b, c) {
            var s, r = b.cy + "*",
                q = a.eC.get(r)
            if (q != null) return q
            s = H.u4(a, b, r, c)
            a.eC.set(r, s)
            return s
        },
        u4(a, b, c, d) {
            var s, r, q
            if (d) {
                s = b.y
                if (!H.isStrongTopType(b)) r = b === t.P || b === t.T || s === 7 || s === 6
                else r = true
                if (r) return b
            }
            q = new H.Rti(null, null)
            q.y = 6
            q.z = b
            q.cy = c
            return H._Universe__installTypeTests(a, q)
        },
        _Universe__lookupQuestionRti(a, b, c) {
            var s, r = b.cy + "?",
                q = a.eC.get(r)
            if (q != null) return q
            s = H.u3(a, b, r, c)
            a.eC.set(r, s)
            return s
        },
        u3(a, b, c, d) {
            var s, r, q, p
            if (d) {
                s = b.y
                if (!H.isStrongTopType(b))
                    if (!(b === t.P || b === t.T))
                        if (s !== 7) r = s === 8 && H.lz(b.z)
                        else r = true
                    else r = true
                else r = true
                if (r) return b
                else if (s === 1 || b === t.aw) return t.P
                else if (s === 6) {
                    q = b.z
                    if (q.y === 8 && H.lz(q.z)) return q
                    else return H.Rti__getQuestionFromStar(a, b)
                }
            }
            p = new H.Rti(null, null)
            p.y = 7
            p.z = b
            p.cy = c
            return H._Universe__installTypeTests(a, p)
        },
        _Universe__lookupFutureOrRti(a, b, c) {
            var s, r = b.cy + "/",
                q = a.eC.get(r)
            if (q != null) return q
            s = H.u1(a, b, r, c)
            a.eC.set(r, s)
            return s
        },
        u1(a, b, c, d) {
            var s, r, q
            if (d) {
                s = b.y
                if (!H.isStrongTopType(b))
                    if (!(b === t.c)) r = b === t.K
                    else r = true
                else r = true
                if (r || b === t.K) return b
                else if (s === 1) return H._Universe__lookupInterfaceRti(a, "bl", [b])
                else if (b === t.P || b === t.T) return t.bG
            }
            q = new H.Rti(null, null)
            q.y = 8
            q.z = b
            q.cy = c
            return H._Universe__installTypeTests(a, q)
        },
        _Universe__lookupGenericFunctionParameterRti(a, b) {
            var s, r, q = "" + b + "^",
                p = a.eC.get(q)
            if (p != null) return p
            s = new H.Rti(null, null)
            s.y = 13
            s.z = b
            s.cy = q
            r = H._Universe__installTypeTests(a, s)
            a.eC.set(q, r)
            return r
        },
        iv(a) {
            var s, r, q, p = a.length
            for (s = "", r = "", q = 0; q < p; ++q, r = ",") s += r + a[q].cy
            return s
        },
        u0(a) {
            var s, r, q, p, o, n, m = a.length
            for (s = "", r = "", q = 0; q < m; q += 3, r = ",") {
                p = a[q]
                o = a[q + 1] ? "!" : ":"
                n = a[q + 2].cy
                s += r + p + o + n
            }
            return s
        },
        _Universe__lookupInterfaceRti(a, b, c) {
            var s, r, q, p = b
            if (c.length > 0) p += "<" + H.iv(c) + ">"
            s = a.eC.get(p)
            if (s != null) return s
            r = new H.Rti(null, null)
            r.y = 9
            r.z = b
            r.Q = c
            if (c.length > 0) r.c = c[0]
            r.cy = p
            q = H._Universe__installTypeTests(a, r)
            a.eC.set(p, q)
            return q
        },
        _Universe__lookupBindingRti(a, b, c) {
            var s, r, q, p, o, n
            if (b.y === 10) {
                s = b.z
                r = b.Q.concat(c)
            } else {
                r = c
                s = b
            }
            q = s.cy + (";<" + H.iv(r) + ">")
            p = a.eC.get(q)
            if (p != null) return p
            o = new H.Rti(null, null)
            o.y = 10
            o.z = s
            o.Q = r
            o.cy = q
            n = H._Universe__installTypeTests(a, o)
            a.eC.set(q, n)
            return n
        },
        _Universe__lookupFunctionRti(a, b, c) {
            var s, r, q, p, o, n = b.cy,
                m = c.a,
                l = m.length,
                k = c.b,
                j = k.length,
                i = c.c,
                h = i.length,
                g = "(" + H.iv(m)
            if (j > 0) {
                s = l > 0 ? "," : ""
                r = H.iv(k)
                g += s + "[" + r + "]"
            }
            if (h > 0) {
                s = l > 0 ? "," : ""
                r = H.u0(i)
                g += s + "{" + r + "}"
            }
            q = n + (g + ")")
            p = a.eC.get(q)
            if (p != null) return p
            o = new H.Rti(null, null)
            o.y = 11
            o.z = b
            o.Q = c
            o.cy = q
            r = H._Universe__installTypeTests(a, o)
            a.eC.set(q, r)
            return r
        },
        _Universe__lookupGenericFunctionRti(a, b, c, d) {
            var s, r = b.cy + ("<" + H.iv(c) + ">"),
                q = a.eC.get(r)
            if (q != null) return q
            s = H.u2(a, b, c, r, d)
            a.eC.set(r, s)
            return s
        },
        u2(a, b, c, d, e) {
            var s, r, q, p, o, n, m, l
            if (e) {
                s = c.length
                r = H.ld(s)
                for (q = 0, p = 0; p < s; ++p) {
                    o = c[p]
                    if (o.y === 1) {
                        r[p] = o;
                        ++q
                    }
                }
                if (q > 0) {
                    n = H._substitute(a, b, r, 0)
                    m = H._substituteArray(a, c, r, 0)
                    return H._Universe__lookupGenericFunctionRti(a, n, m, c !== m)
                }
            }
            l = new H.Rti(null, null)
            l.y = 12
            l.z = b
            l.Q = c
            l.cy = d
            return H._Universe__installTypeTests(a, l)
        },
        oe(a, b, c, d) {
            return {
                u: a,
                e: b,
                r: c,
                s: [],
                p: 0,
                n: d
            }
        },
        _Parser_parse(a) {
            var s, r, q, t3, array, head, m, l, k, j, i, h, g = a.r,
                f = a.s
            for (s = g.length, r = 0; r < s;) {
                q = g.charCodeAt(r)
                if (q >= 48 && q <= 57) r = H._Parser_handleDigit(r + 1, q, g, f)
                else if ((((q | 32) >>> 0) - 97 & 65535) < 26 || q === 95 || q === 36)
                    r = H._Parser_handleIdentifier(a, r, g, f, false)
                else if (q === 46)
                    r = H._Parser_handleIdentifier(a, r, g, f, true)
                else {
                    ++r
                    switch (q) {
                        case 44:
                            break
                        case 58:
                            f.push(false)
                            break
                        case 33:
                            f.push(true)
                            break
                        case 59:
                            f.push(H._Parser_toType(a.u, a.e, f.pop()))
                            break
                        case 94:
                            f.push(H._Universe__lookupGenericFunctionParameterRti(a.u, f.pop()))
                            break
                        case 35:
                            f.push(H._Universe__lookupTerminalRti(a.u, 5, "#"))
                            break
                        case 64:
                            f.push(H._Universe__lookupTerminalRti(a.u, 2, "@"))
                            break
                        case 126:
                            f.push(H._Universe__lookupTerminalRti(a.u, 3, "~"))
                            break
                        case 60:
                            f.push(a.p)
                            a.p = f.length
                            break
                        case 62:
                            t3 = a.u
                            array = f.splice(a.p)
                            H._Parser_toTypes(a.u, a.e, array)
                            a.p = f.pop()
                            head = f.pop()
                            if (typeof head == "string") f.push(H._Universe__lookupInterfaceRti(t3, head, array))
                            else {
                                m = H._Parser_toType(t3, a.e, head)
                                switch (m.y) {
                                    case 11:
                                        f.push(H._Universe__lookupGenericFunctionRti(t3, m, array, a.n))
                                        break
                                    default:
                                        f.push(H._Universe__lookupBindingRti(t3, m, array))
                                        break
                                }
                            }
                            break
                        case 38:
                            H._Parser_handleExtendedOperations(a, f)
                            break
                        case 42:
                            l = a.u
                            f.push(H._Universe__lookupStarRti(l, H._Parser_toType(l, a.e, f.pop()), a.n))
                            break
                        case 63:
                            l = a.u
                            f.push(H._Universe__lookupQuestionRti(l, H._Parser_toType(l, a.e, f.pop()), a.n))
                            break
                        case 47:
                            l = a.u
                            f.push(H._Universe__lookupFutureOrRti(l, H._Parser_toType(l, a.e, f.pop()), a.n))
                            break
                        case 40:
                            f.push(a.p)
                            a.p = f.length
                            break
                        case 41:
                            t3 = a.u
                            k = new H.ib()
                            j = t3.sEA
                            i = t3.sEA
                            head = f.pop()
                            if (typeof head == "number") switch (head) {
                                case -1:
                                    j = f.pop()
                                    break
                                case -2:
                                    i = f.pop()
                                    break
                                default:
                                    f.push(head)
                                    break
                            } else f.push(head)
                            array = f.splice(a.p)
                            H._Parser_toTypes(a.u, a.e, array)
                            a.p = f.pop()
                            k.a = array
                            k.b = j
                            k.c = i
                            f.push(H._Universe__lookupFunctionRti(t3, H._Parser_toType(t3, a.e, f.pop()), k))
                            break
                        case 91:
                            f.push(a.p)
                            a.p = f.length
                            break
                        case 93:
                            array = f.splice(a.p)
                            H._Parser_toTypes(a.u, a.e, array)
                            a.p = f.pop()
                            f.push(array)
                            f.push(-1)
                            break
                        case 123:
                            f.push(a.p)
                            a.p = f.length
                            break
                        case 125:
                            array = f.splice(a.p)
                            H._Parser_toTypesNamed(a.u, a.e, array)
                            a.p = f.pop()
                            f.push(array)
                            f.push(-2)
                            break
                        default:
                            throw "Bad character " + q
                    }
                }
            }
            h = f.pop()
            return H._Parser_toType(a.u, a.e, h)
        },
        _Parser_handleDigit(a, b, c, d) {
            var s, r, q = b - 48
            for (s = c.length; a < s; ++a) {
                r = c.charCodeAt(a)
                if (!(r >= 48 && r <= 57)) break
                q = q * 10 + (r - 48)
            }
            d.push(q)
            return a
        },
        _Parser_handleIdentifier(parser, start, source, stack, has_period) {
            var s, r, q, p, o, n, m = start + 1
            for (s = source.length; m < s; ++m) {
                r = source.charCodeAt(m)
                if (r === 46) {
                    if (has_period) break
                    has_period = true
                } else {
                    if (!((((r | 32) >>> 0) - 97 & 65535) < 26 || r === 95 || r === 36)) q = r >= 48 && r <= 57
                    else q = true
                    if (!q) break
                }
            }
            p = source.substring(start, m)
            if (has_period) {
                s = parser.u
                o = parser.e
                if (o.y === 10) o = o.z
                n = H.ua(s, o.z)[p]
                if (n == null) H.throw_expression('No "' + p + '" in "' + H.Rti__getCanonicalRecipe(o) + '"')
                stack.push(H._Universe_evalInEnvironment(s, o, n))
            } else stack.push(p)
            return m
        },
        _Parser_handleExtendedOperations(a, stack) {
            var s = stack.pop()
            if (0 === s) {
                stack.push(H._Universe__lookupTerminalRti(a.u, 1, "0&"))
                return
            }
            if (1 === s) {
                stack.push(H._Universe__lookupTerminalRti(a.u, 4, "1&"))
                return
            }
            throw H.wrap_expression(P.iP("Unexpected extended operation " + H.as_string(s)))
        },
        _Parser_toType(a, b, c) {
            if (typeof c == "string") return H._Universe__lookupInterfaceRti(a, c, a.sEA)
            else if (typeof c == "number") return H._Parser_indexToType(a, b, c)
            else return c
        },
        _Parser_toTypes(a, b, c) {
            var s, r = c.length
            for (s = 0; s < r; ++s) c[s] = H._Parser_toType(a, b, c[s])
        },
        _Parser_toTypesNamed(a, b, c) {
            var s, r = c.length
            for (s = 2; s < r; s += 3) c[s] = H._Parser_toType(a, b, c[s])
        },
        _Parser_indexToType(a, b, c) {
            var s, r, q = b.y
            if (q === 10) {
                if (c === 0) return b.z
                s = b.Q
                r = s.length
                if (c <= r) return s[c - 1]
                c -= r
                b = b.z
                q = b.y
            } else if (c === 0) return b
            if (q !== 9) throw H.wrap_expression(P.iP("Indexed base must be an interface type"))
            s = b.Q
            if (c <= s.length) return s[c - 1]
            throw H.wrap_expression(P.iP("Bad index " + c + " for " + b.k(0)))
        },
        _isSubtype(a, b, c, d, e) {
            var s, r, q, p, o, n, m, l, k, j
            if (b === d) return true
            if (!H.isStrongTopType(d))
                if (!(d === t.c)) s = d === t.K
                else s = true
            else s = true
            if (s) return true
            r = b.y
            if (r === 4) return true
            if (H.isStrongTopType(b)) return false
            if (b.y !== 1) s = b === t.P || b === t.T
            else s = true
            if (s) return true
            q = r === 13
            if (q)
                if (H._isSubtype(a, c[b.z], c, d, e)) return true
            p = d.y
            if (r === 6) return H._isSubtype(a, b.z, c, d, e)
            if (p === 6) {
                s = d.z
                return H._isSubtype(a, b, c, s, e)
            }
            if (r === 8) {
                if (!H._isSubtype(a, b.z, c, d, e)) return false
                return H._isSubtype(a, H.Rti__getFutureFromFutureOr(a, b), c, d, e)
            }
            if (r === 7) {
                s = H._isSubtype(a, b.z, c, d, e)
                return s
            }
            if (p === 8) {
                if (H._isSubtype(a, b, c, d.z, e)) return true
                return H._isSubtype(a, b, c, H.Rti__getFutureFromFutureOr(a, d), e)
            }
            if (p === 7) {
                s = H._isSubtype(a, b, c, d.z, e)
                return s
            }
            if (q) return false
            s = r !== 11
            if ((!s || r === 12) && d === t.Z) return true
            if (p === 12) {
                if (b === t.O) return true
                if (r !== 12) return false
                o = b.Q
                n = d.Q
                m = o.length
                if (m !== n.length) return false
                c = c == null ? o : o.concat(c)
                e = e == null ? n : n.concat(e)
                for (l = 0; l < m; ++l) {
                    k = o[l]
                    j = n[l]
                    if (!H._isSubtype(a, k, c, j, e) || !H._isSubtype(a, j, e, k, c)) return false
                }
                return H._isFunctionSubtype(a, b.z, c, d.z, e)
            }
            if (p === 11) {
                if (b === t.O) return true
                if (s) return false
                return H._isFunctionSubtype(a, b, c, d, e)
            }
            if (r === 9) {
                if (p !== 9) return false
                return H._isFunctionSubtype(a, b, c, d, e)
            }
            return false
        },
        _isFunctionSubtype(a2, a3, a4, a5, a6) {
            var s, r, q, p, o, n, m, l, k, j, i, h, g, f, e, d, c, b, a, a0, a1
            if (!H._isSubtype(a2, a3.z, a4, a5.z, a6)) return false
            s = a3.Q
            r = a5.Q
            q = s.a
            p = r.a
            o = q.length
            n = p.length
            if (o > n) return false
            m = n - o
            l = s.b
            k = r.b
            j = l.length
            i = k.length
            if (o + j < n + i) return false
            for (h = 0; h < o; ++h) {
                g = q[h]
                if (!H._isSubtype(a2, p[h], a6, g, a4)) return false
            }
            for (h = 0; h < m; ++h) {
                g = l[h]
                if (!H._isSubtype(a2, p[o + h], a6, g, a4)) return false
            }
            for (h = 0; h < i; ++h) {
                g = l[m + h]
                if (!H._isSubtype(a2, k[h], a6, g, a4)) return false
            }
            f = s.c
            e = r.c
            d = f.length
            c = e.length
            for (b = 0, a = 0; a < c; a += 3) {
                a0 = e[a]
                for (; true;) {
                    if (b >= d) return false
                    a1 = f[b]
                    b += 3
                    if (a0 < a1) return false
                    if (a1 < a0) continue
                    g = f[b - 1]
                    if (!H._isSubtype(a2, e[a + 2], a6, g, a4)) return false
                    break
                }
            }
            return true
        },
        _isFunctionSubtype(a, b, c, d, e) {
            var s, r, q, p, o, n, m, l = b.z,
                k = d.z
            for (; l !== k;) {
                s = a.tR[l]
                if (s == null) return false
                if (typeof s == "string") {
                    l = s
                    continue
                }
                r = s[k]
                if (r == null) return false
                q = r.length
                p = q > 0 ? new Array(q) : init.typeUniverse.sEA
                for (o = 0; o < q; ++o) p[o] = H._Universe_evalInEnvironment(a, b, r[o])
                return H.om(a, p, null, c, d.Q, e)
            }
            n = b.Q
            m = d.Q
            return H.om(a, n, null, c, m, e)
        },
        om(a, b, c, d, e, f) {
            var s, r, q, p = b.length
            for (s = 0; s < p; ++s) {
                r = b[s]
                q = e[s]
                if (!H._isSubtype(a, r, d, q, f)) return false
            }
            return true
        },
        lz(a) {
            var s, r = a.y
            if (!(a === t.P || a === t.T))
                if (!H.isStrongTopType(a))
                    if (r !== 7)
                        if (!(r === 6 && H.lz(a.z))) s = r === 8 && H.lz(a.z)
                        else s = true
                    else s = true
                else s = true
            else s = true
            return s
        },
        v0(a) {
            var s
            if (!H.isStrongTopType(a))
                if (!(a === t.c)) s = a === t.K
                else s = true
            else s = true
            return s
        },
        isStrongTopType(a) {
            var kind = a.y
            // t.cK nullable_Object
            return kind === 2 || kind === 3 || kind === 4 || kind === 5 || a === t.cK
        },
        ol(a, b) {
            var s, r, q = Object.keys(b),
                p = q.length
            for (s = 0; s < p; ++s) {
                r = q[s]
                a[r] = b[r]
            }
        },
        ld(a) {
            return a > 0 ? new Array(a) : init.typeUniverse.sEA
        },
        Rti: function Rti(a, b) {
            var _ = this
            _.a = a
            _.b = b
            _.x = _.r = _.c = null
            _.y = 0
            _.cy = _.cx = _.ch = _.Q = _.z = null
        },
        ib: function ib() {
            this.c = this.b = this.a = null
        },
        iu: function iu(a) {
            this.a = a
        },
        i9: function i9() { },
        eI: function eI(a) {
            this.a = a
        },
        ve(a) {
            if (typeof dartPrint == "function") {
                dartPrint(a)
                return
            }
            if (typeof console == "object" && typeof console.log != "undefined") {
                console.log(a)
                return
            }
            if (typeof window == "object") return
            if (typeof print == "function") {
                print(a)
                return
            }
            throw "Unable to print message: " + String(a)
        },
        vm(a) {
            return H.throw_expression(new H.fz("Field '" + H.as_string(a) + "' has been assigned during initialization."))
        }
    },
    J = {
        makeDispatchRecord(a, b, c, d) {
            return {
                i: a,
                p: b,
                e: c,
                x: d
            }
        },
        getNativeInterceptor(a) {
            var proto, r, q, interceptor, o, n = a[init.dispatchPropertyName]
            if (n == null)
                if ($.mA == null) {
                    H.initNativeDispatch()
                    n = a[init.dispatchPropertyName]
                } if (n != null) {
                    proto = n.p
                    if (false === proto) return n.i
                    if (true === proto) return a
                    r = Object.getPrototypeOf(a)
                    if (proto === r) return n.i
                    if (n.e === r) throw H.wrap_expression(P.hT("Return interceptor for " + H.as_string(proto(a, n))))
                }
            q = a.constructor
            if (q == null) interceptor = null
            else {
                o = $.kU
                if (o == null) o = $.kU = init.getIsolateTag("_$dart_js")
                interceptor = q[o]
            }
            if (interceptor != null) return interceptor

            // interceptor = H.lookupAndCacheInterceptor(a)
            // if (interceptor != null) return interceptor

            if (typeof a == "function") return C.JavaScriptFunction
            proto = Object.getPrototypeOf(a)
            if (proto == null) return C.PlainJavaScriptObject
            if (proto === Object.prototype) return C.PlainJavaScriptObject
            if (typeof q == "function") {
                o = $.kU
                if (o == null) o = $.kU = init.getIsolateTag("_$dart_js")
                Object.defineProperty(q, o, {
                    value: C.UnknownJavaScriptObject,
                    enumerable: false,
                    writable: true,
                    configurable: true
                })
                return C.UnknownJavaScriptObject
            }
            return C.UnknownJavaScriptObject
        },
        rZ(a, b) {
            if (!H.aP(a)) throw H.wrap_expression(P.da(a, "length", "is not an integer"))
            if (a < 0 || a > 4294967295) throw H.wrap_expression(P.a8(a, 0, 4294967295, "length", null))
            return J.t0(new Array(a), b)
        },
        t_(a, b) {
            if (!H.aP(a) || a < 0) throw H.wrap_expression(P.bz("Length must be a non-negative integer: " + H.as_string(a), null))
            return H.b(new Array(a), b.i("E<0>"))
        },
        t0(a, b) {
            return J.nL(H.b(a, b.i("E<0>")))
        },
        nL(a) {
            a.fixed$length = Array
            return a
        },
        t1(a, b) {
            return J.lV(a, b)
        },
        check_str_legeal(a) {
            if (a < 256) switch (a) {
                case 9:
                case 10:
                case 11:
                case 12:
                case 13:
                case 32:
                case 133:
                case 160:
                    return true
                default:
                    return false
            }
            switch (a) {
                case 5760:
                case 8192:
                case 8193:
                case 8194:
                case 8195:
                case 8196:
                case 8197:
                case 8198:
                case 8199:
                case 8200:
                case 8201:
                case 8202:
                case 8232:
                case 8233:
                case 8239:
                case 8287:
                case 12288:
                case 65279:
                    return true
                default:
                    return false
            }
        },
        check_from_start(a, b) {
            var s, r
            for (s = a.length; b < s;) {
                r = C.String.a8(a, b)
                if (r !== 32 && r !== 13 && !J.check_str_legeal(r)) break;
                ++b
            }
            return b
        },
        check_from_end(a, b) {
            var s, r
            for (; b > 0; b = s) {
                s = b - 1
                r = C.String.aQ(a, s)
                if (r !== 32 && r !== 13 && !J.check_str_legeal(r)) break
            }
            return b
        },
        cV(a) {
            if (typeof a == "number") {
                if (Math.floor(a) == a) return J.JsInt.prototype
                return J.jF.prototype
            }
            if (typeof a == "string") return J.JsString.prototype
            if (a == null) return J.cs.prototype
            if (typeof a == "boolean") return J.fw.prototype
            if (a.constructor == Array) return J.JsArray.prototype
            if (typeof a != "object") {
                if (typeof a == "function") return J.JavaScriptFunction.prototype
                return a
            }
            if (a instanceof P.Object) return a
            return J.getNativeInterceptor(a)
        },
        a3(a) {
            if (typeof a == "string") return J.JsString.prototype
            if (a == null) return a
            if (a.constructor == Array) return J.JsArray.prototype
            if (typeof a != "object") {
                if (typeof a == "function") return J.JavaScriptFunction.prototype
                return a
            }
            if (a instanceof P.Object) return a
            return J.getNativeInterceptor(a)
        },
        cW(a) {
            if (a == null) return a
            if (a.constructor == Array) return J.JsArray.prototype
            if (typeof a != "object") {
                if (typeof a == "function") return J.JavaScriptFunction.prototype
                return a
            }
            if (a instanceof P.Object) return a
            return J.getNativeInterceptor(a)
        },
        oA(a) {
            if (typeof a == "number") return J.JsNumber.prototype
            if (typeof a == "string") return J.JsString.prototype
            if (a == null) return a
            if (!(a instanceof P.Object)) return J.UnknownJavaScriptObject.prototype
            return a
        },
        aQ(a) {
            if (typeof a == "string") return J.JsString.prototype
            if (a == null) return a
            if (!(a instanceof P.Object)) return J.UnknownJavaScriptObject.prototype
            return a
        },
        uR(a) {
            if (a == null) return J.cs.prototype
            if (!(a instanceof P.Object)) return J.UnknownJavaScriptObject.prototype
            return a
        },
        bv(a) {
            if (a == null) return a
            if (typeof a != "object") {
                if (typeof a == "function") return J.JavaScriptFunction.prototype
                return a
            }
            if (a instanceof P.Object) return a
            return J.getNativeInterceptor(a)
        },
        uS(a) {
            if (a == null) return a
            if (!(a instanceof P.Object)) return J.UnknownJavaScriptObject.prototype
            return a
        },
        iN(a, b) {
            if (typeof a == "number" && typeof b == "number") return a + b
            return J.oA(a).B(a, b)
        },
        Y(a, b) {
            if (a == null) return b == null
            if (typeof a != "object") return b != null && a === b
            return J.cV(a).aW(a, b)
        },
        J(a, b) {
            if (typeof b === "number")
                if (a.constructor == Array || typeof a == "string" || H.oG(a, a[init.dispatchPropertyName]))
                    if (b >>> 0 === b && b < a.length) return a[b]
            return J.a3(a).h(a, b)
        },
        lT(a, b, c) {
            if (typeof b === "number")
                if ((a.constructor == Array || H.oG(a, a[init.dispatchPropertyName])) && !a.immutable$list && b >>> 0 === b && b < a.length) return a[b] = c
            return J.cW(a).m(a, b, c)
        },
        rr(a, b) {
            return J.cW(a).a5(a, b)
        },
        rs(a, b, c, d) {
            // if (run_env.from_code) {
            //     console.log("rs", a, "|", b, "|", c, "|", d)
            //     return
            // }
            return J.bv(a).eF(a, b, c, d)
        },
        lU(a, b) {
            return J.aQ(a).de(a, b)
        },
        rt(a, b, c) {
            return J.aQ(a).bK(a, b, c)
        },
        ny(a, b) {
            return J.aQ(a).aQ(a, b)
        },
        lV(a, b) {
            return J.oA(a).bg(a, b)
        },
        lW(a, b) {
            return J.a3(a).w(a, b)
        },
        lX(a, b, c) {
            return J.a3(a).dh(a, b, c)
        },
        iO(a, b, c, d) {
            return J.bv(a).eQ(a, b, c, d)
        },
        ru(a, b) {
            return J.cW(a).ai(a, b)
        },
        nz(a, b) {
            return J.aQ(a).cl(a, b)
        },
        bj(a, b, c, d, e) {
            return J.bv(a).eR(a, b, c, d, e)
        },
        lY(a, b) {
            return J.cW(a).aw(a, b)
        },
        rv(a) {
            return J.bv(a).geH(a)
        },
        cm(a) {
            return J.bv(a).gck(a)
        },
        lZ(a) {
            return J.cV(a).gak(a)
        },
        by(a) {
            return J.cW(a).ga0(a)
        },
        aw(a) {
            return J.a3(a).gp(a)
        },
        m_(a, b) {
            return J.a3(a).aT(a, b)
        },
        rw(a, b, c) {
            return J.aQ(a).dq(a, b, c)
        },
        m0(a, b, c) {
            return J.bv(a).dt(a, b, c)
        },
        nA(a) {
            return J.cW(a).fq(a)
        },
        rx(a) {
            return J.bv(a).fv(a)
        },
        ry(a, b) {
            // set a length -> b
            return J.a3(a).sp(a, b)
        },
        m1(a, b) {
            return J.aQ(a).bA(a, b)
        },
        rz(a, b, c) {
            return J.uS(a).dN(a, b, c)
        },
        nB(a, b) {
            return J.aQ(a).ay(a, b)
        },
        rA(a, b, c) {
            return J.aQ(a).af(a, b, c)
        },
        rB(a) {
            return J.aQ(a).fN(a)
        },
        b4(a) {
            return J.cV(a).k(a)
        },
        rC(a, b, c, d, e, f, g) {
            return J.bv(a).fO(a, b, c, d, e, f, g)
        },
        rD(a) {
            // return J.aQ(a).trim_name(a)
            J.JsString.prototype.trim_name(a)
        },
        Interceptor: function af() { },
        fw: function fw() { },
        cs: function cs() { },
        bE: function bE() { },
        PlainJavaScriptObject: function fO() { },
        UnknownJavaScriptObject: function bs() { },
        JavaScriptFunction: function bn() { },
        JsArray: function E(a) {
            this.$ti = a
        },
        JsUnmodifiableArray: function jG(a) {
            this.$ti = a
        },
        db: function db(a, b) {
            var _ = this
            _.a = a
            _.b = b
            _.c = 0
            _.d = null
        },
        JsNumber: function dA() { },
        JsInt: function dz() { },
        jF: function jF() { },
        JsString: function bD() { }
    },
    L = {
        ProfileWinChance: function iR(a, b, c, d, e, f, g) {
            var _ = this
            _.a = a
            _.b = b
            _.c = 1000
            _.d = 33554431
            _.e = c
            _.f = d
            _.r = e
            _.x = f
            _.z = _.y = 0
            _.Q = null
            _.ch = g
        },
        iS: function iS() { },
        iT: function iT() { },
        iU: function iU(a) {
            this.a = a
        }
    },
    LangData = {
        eQ(a) {
            var s, r, q, p, o, n
            a.toString
            s = new H.ff(a)
            s = new H.cv(s, s.gp(s))
            r = 7
            q = 5
            p = 3
            o = 1
            for (; s.u();) {
                n = s.d
                r = C.JsInt.V((r + n + o) * 17, 52)
                q = C.JsInt.V((q + n * r) * 23, 52)
                p = C.JsInt.V((p + n + q) * 47, 52)
                o = C.JsInt.V((o + n * p) * 13, 52)
            }
            r = r < 26 ? r + 65 : r + 71
            q = q < 26 ? q + 65 : q + 71
            p = p < 26 ? p + 65 : p + 71
            return P.mh(H.b([r, q, p, o < 26 ? o + 65 : o + 71], t.i), 0, null)
        },
        j(a, b) {
            // let result = C.e.bt(0, X.f4(a, b))
            let result = C.T_kk.ab(X.f4(a, b))
            logger.debug("O.j", a, b, result)
            return result
        },
        get_lang(a) {
            var s = $.od.h(0, a)
            logger.debug("O.d", a, s)
            if (s == null) return ""
            return s
        },
        load_lang(a) {
            J.lY(a, new LangData.lA())
        },
        lA: function lA() { },
        fZ(a) {
            var s = H.b([0], t.i)
            C.Array.a5(s, C.e.gaB().ab(a))
            return s
        },
        SuperRC4: function b9() {
            this.b = this.a = 0
            this.c = null
        },
        k_: function k_(a, b) {
            this.a = a
            this.b = b
        },
        oC(a) {
            var s, r, q = "deepmess.com"
            if (a) {
                s = new Y.RC4()
                s.bd(C.e.gaB().ab(q), 2)
                s.di(H.b([32, 46, 189, 177, 148, 32], t.i))
                return s
            } else {
                r = new Y.RC4()
                r.bd(C.e.gaB().ab(q), 1)
                return r
            }
        }
    },
    P = {
        _AsyncRun__initializeScheduleImmediate() {
            // if (run_env.from_code) {
            //     console.log("creating scheduleImmediate")
            // }
            logger.debug("creating scheduleImmediate")
            var s, r, q = {}
            if (self.scheduleImmediate != null) {
                return P.uK()
            }
            if (self.MutationObserver != null && self.document != null) {
                s = self.document.createElement("div")
                r = self.document.createElement("span")
                q.a = null
                new self.MutationObserver(H.convert_dart_closure_to_js_md5(new P.kB(q), 1)).observe(s, {
                    childList: true
                })
                return new P.kA(q, s, r)
            } else if (self.setImmediate != null) {
                // _AsyncRun__scheduleImmediateWithSetImmediate
                return P.uL()
            }
            // _AsyncRun__scheduleImmediateWithTimer
            return P.uM()

        },
        _AsyncRun__scheduleImmediateJsOverride(a) {
            self.scheduleImmediate(H.convert_dart_closure_to_js_md5(new P.kC(a), 0))
        },
        _AsyncRun__scheduleImmediateWithSetImmediate(a) {
            self.setImmediate(H.convert_dart_closure_to_js_md5(new P.kD(a), 0))
        },
        _AsyncRun__scheduleImmediateWithTimer(a) {
            P.Timer__createTimer(C.I, a)
        },
        Timer__createTimer(a, b) {
            var s = C.JsInt.ag(a.a, 1000)
            return P.Timer_impl(s < 0 ? 0 : s, b)
        },
        Timer_impl(a, b) {
            var s = new P.l8()
            s.e8(a, b)
            return s
        },
        _makeAsyncAwaitCompleter(a) {
            return new P.i_(new P._Future($.P, a.i("U<0>")), a.i("i_<0>"))
        },
        _asyncStartSync(a, b) {
            a.$2(0, null)
            // a(0, null)
            b.b = true
            return b.a
        },
        _asyncAwait(a, b) {
            P._awaitOnObject(a, b)
        },
        async_return(a, b) {
            b.bM(0, a)
        },
        async_rethrow(a, b) {
            b.cj(H.unwrap_Exception(a), H.getTraceFromException(a))
        },
        _awaitOnObject(a, b) {
            var s, r, q = new P.lh(b),
                p = new P.li(b)
            if (a instanceof P._Future) a.d7(q, p, t.z)
            else {
                s = t.z
                if (t.h.b(a)) a.cz(q, p, s)
                else {
                    r = new P._Future($.P, t.eI)
                    r.a = 8
                    r.c = a
                    r.d7(q, p, s)
                }
            }
        },
        _wrapJsFunctionForAsync(func) {
            var protected_func = function (fn, error_) {
                return function (error_code, async_result) {
                    while (true) try {
                        if (run_env.from_code) {
                            // console.log("O._wrapJsFunctionForAsync", error_code, async_result)
                        }
                        fn(error_code, async_result)
                        break
                    } catch (error) {
                        async_result = error
                        error_code = error_
                    }
                }
            }(func, 1)
            return $.P.ct(new P._wrapJsFunctionForAsync_closure(protected_func))
        },
        async_error(a, b) {
            var s = H.ls(a, "error", t.K)
            return new P.f3(s, b == null ? P.AsyncError_defaultStackTrace(a) : b)
        },
        AsyncError_defaultStackTrace(a) {
            var s
            if (t.u.b(a)) {
                s = a.gbz()
                if (s != null) return s
            }
            return C.G
        },
        future_future_delayed(a, b) {
            var s = new P._Future($.P, b.i("U<0>"))
            P.Timer_Timer(a, new P.jp(null, s, b))
            return s
        },
        rM(a) {
            return new P.cg(new P._Future($.P, a.i("U<0>")), a.i("cg<0>"))
        },
        mk(a, b) {
            var s, r
            for (; s = a.a, (s & 4) !== 0;) a = a.c
            if ((s & 24) !== 0) {
                r = b.bI()
                b.c1(a)
                P.cO(b, r)
            } else {
                r = b.c
                b.a = b.a & 1 | 4
                b.c = a
                a.d3(r)
            }
        },
        cO(a, b) {
            var s, r, q, p, o, n, m, l, k, j, i, h, g, f = {},
                e = f.a = a
            for (s = t.h; true;) {
                r = {}
                q = e.a
                p = (q & 16) === 0
                o = !p
                if (b == null) {
                    if (o && (q & 1) === 0) {
                        e = e.c
                        P.iC(e.a, e.b)
                    }
                    return
                }
                r.a = b
                n = b.a
                for (e = b; n != null; e = n, n = m) {
                    e.a = null
                    P.cO(f.a, e)
                    r.a = n
                    m = n.a
                }
                q = f.a
                l = q.c
                r.b = o
                r.c = l
                if (p) {
                    k = e.c
                    k = (k & 1) !== 0 || (k & 15) === 8
                } else k = true
                if (k) {
                    j = e.b.b
                    if (o) {
                        q = q.b === j
                        q = !(q || q)
                    } else q = false
                    if (q) {
                        P.iC(l.a, l.b)
                        return
                    }
                    i = $.P
                    if (i !== j) $.P = j
                    else i = null
                    e = e.c
                    if ((e & 15) === 8) new P.kR(r, f, o).$0()
                    else if (p) {
                        if ((e & 1) !== 0) new P.kQ(r, l).$0()
                    } else if ((e & 2) !== 0) new P.kP(f, r).$0()
                    if (i != null) $.P = i
                    e = r.c
                    if (s.b(e)) {
                        q = r.a.$ti
                        q = q.i("bl<2>").b(e) || !q.Q[1].b(e)
                    } else q = false
                    if (q) {
                        h = r.a.b
                        if (e instanceof P._Future)
                            if ((e.a & 24) !== 0) {
                                g = h.c
                                h.c = null
                                b = h.bJ(g)
                                h.a = e.a & 30 | h.a & 1
                                h.c = e.c
                                f.a = e
                                continue
                            } else P.mk(e, h)
                        else h.cV(e)
                        return
                    }
                }
                h = r.a.b
                g = h.c
                h.c = null
                b = h.bJ(g)
                e = r.b
                q = r.c
                if (!e) {
                    h.a = 8
                    h.c = q
                } else {
                    h.a = h.a & 1 | 16
                    h.c = q
                }
                f.a = h
                e = h
            }
        },
        uz(a, b) {
            if (t.C.b(a)) return b.ct(a)
            if (t.J.b(a)) return a
            throw H.wrap_expression(P.da(a, "onError", u.c))
        },
        uw() {
            var s, r
            for (s = $.cR; s != null; s = $.cR) {
                $.eO = null
                r = s.b
                $.cR = r
                if (r == null) $.eN = null
                s.a.$0()
            }
        },
        uD() {
            $.ms = true
            try {
                P.uw()
            } finally {
                $.eO = null
                $.ms = false
                if ($.cR != null) $.nw().$1(P.ow())
            }
        },
        ou(a) {
            var s = new P.i0(a),
                r = $.eN
            if (r == null) {
                $.cR = $.eN = s
                if (!$.ms) {
                    $.nw().$1(P.ow())
                }
            } else $.eN = r.b = s
        },
        uC(a) {
            var s, r, q, p = $.cR
            if (p == null) {
                P.ou(a)
                $.eO = $.eN
                return
            }
            s = new P.i0(a)
            r = $.eO
            if (r == null) {
                s.b = p
                $.cR = $.eO = s
            } else {
                q = r.b
                s.b = q
                $.eO = r.b = s
                if (q == null) $.eN = s
            }
        },
        oN(a) {
            var s = null,
                r = $.P
            if (C.f === r) {
                P.cS(s, s, C.f, a)
                return
            }
            P.cS(s, s, r, r.cf(a))
        },
        zZ(a) {
            H.ls(a, "stream", t.K)
            return new P.io()
        },
        mu(a) {
            return
        },
        tS(a, b) {
            if (b == null) b = P.uN()
            if (t.da.b(b)) return a.ct(b)
            if (t.aX.b(b)) return b
            throw H.wrap_expression(P.bz("handleError callback must take either an Object (the error), or both an Object (the error) and a StackTrace.", null))
        },
        ux(a, b) {
            P.iC(a, b)
        },
        Timer_Timer(a, b) {
            var s = $.P
            if (s === C.f) return P.Timer__createTimer(a, b)
            return P.Timer__createTimer(a, s.cf(b))
        },
        iC(a, b) {
            P.uC(new P.lo(a, b))
        },
        os(a, b, c, d) {
            var s, r = $.P
            if (r === c) return d.$0()
            $.P = c
            s = r
            try {
                r = d.$0()
                return r
            } finally {
                $.P = s
            }
        },
        ot(a, b, c, d, e) {
            var s, r = $.P
            if (r === c) return d.$1(e)
            $.P = c
            s = r
            try {
                r = d.$1(e)
                return r
            } finally {
                $.P = s
            }
        },
        uA(a, b, c, d, e, f) {
            var s, r = $.P
            if (r === c) return d.$2(e, f)
            $.P = c
            s = r
            try {
                r = d.$2(e, f)
                return r
            } finally {
                $.P = s
            }
        },
        cS(a, b, c, d) {
            if (C.f !== c) d = c.cf(d)
            P.ou(d)
        },
        kB: function kB(a) {
            this.a = a
        },
        kA: function kA(a, b, c) {
            this.a = a
            this.b = b
            this.c = c
        },
        kC: function kC(a) {
            this.a = a
        },
        kD: function kD(a) {
            this.a = a
        },
        l8: function l8() { },
        _TimerImpl_internalCallback: function l9(a, b) {
            this.a = a
            this.b = b
        },
        i_: function i_(a, b) {
            this.a = a
            this.b = false
            this.$ti = b
        },
        lh: function lh(a) {
            this.a = a
        },
        li: function li(a) {
            this.a = a
        },
        _wrapJsFunctionForAsync_closure: function lr(a) {
            this.a = a
        },
        f3: function f3(a, b) {
            this.a = a
            this.b = b
        },
        jp: function jp(a, b, c) {
            this.a = a
            this.b = b
            this.c = c
        },
        i4: function i4() { },
        cg: function cg(a, b) {
            this.a = a
            this.$ti = b
        },
        cN: function cN(a, b, c, d, e) {
            var _ = this
            _.a = null
            _.b = a
            _.c = b
            _.d = c
            _.e = d
            _.$ti = e
        },
        _Future: function U(a, b) {
            var _ = this
            _.a = 0
            _.b = a
            _.c = null
            _.$ti = b
        },
        kH: function kH(a, b) {
            this.a = a
            this.b = b
        },
        kO: function kO(a, b) {
            this.a = a
            this.b = b
        },
        kK: function kK(a) {
            this.a = a
        },
        kL: function kL(a) {
            this.a = a
        },
        kM: function kM(a, b, c) {
            this.a = a
            this.b = b
            this.c = c
        },
        kJ: function kJ(a, b) {
            this.a = a
            this.b = b
        },
        kN: function kN(a, b) {
            this.a = a
            this.b = b
        },
        kI: function kI(a, b, c) {
            this.a = a
            this.b = b
            this.c = c
        },
        kR: function kR(a, b, c) {
            this.a = a
            this.b = b
            this.c = c
        },
        kS: function kS(a) {
            this.a = a
        },
        kQ: function kQ(a, b) {
            this.a = a
            this.b = b
        },
        kP: function kP(a, b) {
            this.a = a
            this.b = b
        },
        i0: function i0(a) {
            this.a = a
            this.b = null
        },
        em: function em() { },
        ke: function ke(a, b) {
            this.a = a
            this.b = b
        },
        kf: function kf(a, b) {
            this.a = a
            this.b = b
        },
        hO: function hO() { },
        hP: function hP() { },
        im: function im() { },
        l2: function l2(a) {
            this.a = a
        },
        i1: function i1() { },
        cK: function cK(a, b, c, d) {
            var _ = this
            _.a = null
            _.b = 0
            _.d = a
            _.e = b
            _.f = c
            _.$ti = d
        },
        cM: function cM(a, b) {
            this.a = a
            this.$ti = b
        },
        i5: function i5(a, b, c, d) {
            var _ = this
            _.x = a
            _.a = b
            _.d = c
            _.e = d
            _.r = null
        },
        i3: function i3() { },
        eF: function eF() { },
        i7: function i7() { },
        er: function er(a) {
            this.b = a
            this.a = null
        },
        ii: function ii() { },
        kW: function kW(a, b) {
            this.a = a
            this.b = b
        },
        eG: function eG() {
            this.c = this.b = null
            this.a = 0
        },
        io: function io() { },
        lf: function lf() { },
        lo: function lo(a, b) {
            this.a = a
            this.b = b
        },
        kX: function kX() { },
        kY: function kY(a, b) {
            this.a = a
            this.b = b
        },
        kZ: function kZ(a, b, c) {
            this.a = a
            this.b = b
            this.c = c
        },
        a0(a, b) {
            return new H.aT(a.i("@<0>").aL(b).i("aT<1,2>"))
        },
        dD(a, b, c) {
            return H.uQ(a, new H.aT(b.i("@<0>").aL(c).i("aT<1,2>")))
        },
        cu(a, b) {
            return new H.aT(a.i("@<0>").aL(b).i("aT<1,2>"))
        },
        c5(a) {
            return new P.eu(a.i("eu<0>"))
        },
        ml() {
            var s = Object.create(null)
            s["<non-identifier-key>"] = s
            delete s["<non-identifier-key>"]
            return s
        },
        rX(a, b, c) {
            var s, r
            if (P.mt(a)) {
                if (b === "(" && c === ")") return "(...)"
                return b + "..." + c
            }
            s = H.b([], t.s)
            $.ch.push(a)
            try {
                P.uu(a, s)
            } finally {
                $.ch.pop()
            }
            r = P.o7(b, s, ", ") + c
            return r.charCodeAt(0) == 0 ? r : r
        },
        IterableBase_iterableToFullString(a, b, c) {
            var s, r
            if (P.mt(a)) return b + "..." + c
            s = new P.cH(b)
            $.ch.push(a)
            try {
                r = s
                r.a = P.o7(r.a, a, ", ")
            } finally {
                $.ch.pop()
            }
            s.a += c
            r = s.a
            return r.charCodeAt(0) == 0 ? r : r
        },
        mt(a) {
            var s, r
            for (s = $.ch.length, r = 0; r < s; ++r)
                if (a === $.ch[r]) return true
            return false
        },
        uu(a, b) {
            var s, r, q, p, o, n, m, l = a.ga0(a),
                k = 0,
                j = 0
            while (true) {
                if (!(k < 80 || j < 3)) break
                if (!l.u()) return
                s = H.as_string(l.gC())
                b.push(s)
                k += s.length + 2;
                ++j
            }
            if (!l.u()) {
                if (j <= 5) return
                r = b.pop()
                q = b.pop()
            } else {
                p = l.gC();
                ++j
                if (!l.u()) {
                    if (j <= 4) {
                        b.push(H.as_string(p))
                        return
                    }
                    r = H.as_string(p)
                    q = b.pop()
                    k += r.length + 2
                } else {
                    o = l.gC();
                    ++j
                    for (; l.u(); p = o, o = n) {
                        n = l.gC();
                        ++j
                        if (j > 100) {
                            while (true) {
                                if (!(k > 75 && j > 3)) break
                                k -= b.pop().length + 2;
                                --j
                            }
                            b.push("...")
                            return
                        }
                    }
                    q = H.as_string(p)
                    r = H.as_string(o)
                    k += r.length + q.length + 4
                }
            }
            if (j > b.length + 2) {
                k += 5
                m = "..."
            } else m = null
            while (true) {
                if (!(k > 80 && b.length > 3)) break
                k -= b.pop().length + 2
                if (m == null) {
                    k += 5
                    m = "..."
                }
            }
            if (m != null) b.push(m)
            b.push(q)
            b.push(r)
        },
        nQ(a, b) {
            var s, r, q = P.c5(b)
            for (s = a.length, r = 0; r < a.length; a.length === s || (0, H.F)(a), ++r) q.j(0, b.a(a[r]))
            return q
        },
        nR(a) {
            var s, r = {}
            if (P.mt(a)) return "{...}"
            s = new P.cH("")
            try {
                $.ch.push(a)
                s.a += "{"
                r.a = true
                J.lY(a, new P.jM(r, s))
                s.a += "}"
            } finally {
                $.ch.pop()
            }
            r = s.a
            return r.charCodeAt(0) == 0 ? r : r
        },
        eu: function eu(a) {
            var _ = this
            _.a = 0
            _.f = _.e = _.d = _.c = _.b = null
            _.r = 0
            _.$ti = a
        },
        kV: function kV(a) {
            this.a = a
            this.c = this.b = null
        },
        ie: function ie(a, b) {
            var _ = this
            _.a = a
            _.b = b
            _.d = _.c = null
        },
        dy: function dy() { },
        dE: function dE() { },
        z: function z() { },
        dG: function dG() { },
        jM: function jM(a, b) {
            this.a = a
            this.b = b
        },
        aU: function aU() { },
        dY: function dY() { },
        eC: function eC() { },
        ev: function ev() { },
        eM: function eM() { },
        uy(a, b) {
            var s, r, q, p = null
            try {
                p = JSON.parse(a)
            } catch (r) {
                s = H.unwrap_Exception(r)
                q = P.FormatException(String(s), null, null)
                throw H.wrap_expression(q)
            }
            q = P.lk(p)
            return q
        },
        lk(a) {
            var s
            if (a == null) return null
            if (typeof a != "object") return a
            if (Object.getPrototypeOf(a) !== Array.prototype) return new P.ic(a, Object.create(null))
            for (s = 0; s < a.length; ++s) a[s] = P.lk(a[s])
            return a
        },
        tL(a, b, c, d) {
            var s, r
            if (b instanceof Uint8Array) {
                s = b
                d = s.length
                if (d - c < 15) return null
                r = P.tM(a, s, c, d)
                if (r != null && a)
                    if (r.indexOf("\ufffd") >= 0) return null
                return r
            }
            return null
        },
        tM(a, b, c, d) {
            var s = a ? $.ri() : $.rh()
            if (s == null) return null
            if (0 === c && d === b.length) return P.o9(s, b)
            return P.o9(s, b.subarray(c, P.cE(c, d, b.length)))
        },
        o9(a, b) {
            var s, r
            try {
                s = a.decode(b)
                return s
            } catch (r) {
                H.unwrap_Exception(r)
            }
            return null
        },
        uc(a) {
            switch (a) {
                case 65:
                    return "Missing extension byte"
                case 67:
                    return "Unexpected extension byte"
                case 69:
                    return "Invalid UTF-8 byte"
                case 71:
                    return "Overlong encoding"
                case 73:
                    return "Out of unicode range"
                case 75:
                    return "Encoded surrogate"
                case 77:
                    return "Unfinished UTF-8 octet sequence"
                default:
                    return ""
            }
        },
        ub(a, b, c) {
            var s, r, q = c - b,
                p = new Uint8Array(q)
            for (s = 0; s < q; ++s) {
                r = a[b + s]
                p[s] = (r & 4294967040) >>> 0 !== 0 ? 255 : r
            }
            return p
        },
        ic: function ic(a, b) {
            this.a = a
            this.b = b
            this.c = null
        },
        id: function id(a) {
            this.a = a
        },
        km: function km() { },
        kl: function kl() { },
        fg: function fg() { },
        fi: function fi() { },
        jg: function jg() { },
        js: function js() { },
        jr: function jr() { },
        jI: function jI() { },
        jJ: function jJ(a) {
            this.a = a
        },
        kj: function kj() { },
        kn: function kn() { },
        lc: function lc(a) {
            this.b = 0
            this.c = a
        },
        kk: function kk(a) {
            this.a = a
        },
        lb: function lb(a) {
            this.a = a
            this.b = 16
            this.c = 0
        },
        oF(a) {
            var s = H.tk(a, null)
            if (s != null) return s
            throw H.wrap_expression(P.FormatException(a, null, null))
        },
        Error__objectToString(a) {
            if (a instanceof H.c_) return a.k(0)
            return "Instance of '" + H.as_string(H.jZ(a)) + "'"
        },
        aL(a, b, c, d) {
            var s, r = c ? J.t_(a, d) : J.rZ(a, d)
            if (a !== 0 && b != null)
                for (s = 0; s < r.length; ++s) r[s] = b
            return r
        },
        List_List_of(a, b, c) {
            var s = P.List_List__of(a, c)
            return s
        },
        List_List__of(a, b) {
            var s, r
            if (Array.isArray(a)) return H.b(a.slice(0), b.i("E<0>")) // JSArray<0>
            s = H.b([], b.i("E<0>"))
            for (r = J.by(a); r.u();) s.push(r.gC())
            return s
        },
        mh(a, b, c) {
            var s, r
            if (Array.isArray(a)) {
                s = a
                r = s.length
                c = P.cE(b, c, r)
                return H.nZ(b > 0 || c < r ? s.slice(b, c) : s)
            }
            if (t.bm.b(a)) return H.tm(a, b, P.cE(b, c, a.length))
            return P.tK(a, b, c)
        },
        tK(a, b, c) {
            var s, r, q, p, o = null
            if (b < 0) throw H.wrap_expression(P.a8(b, 0, a.length, o, o))
            s = c == null
            if (!s && c < b) throw H.wrap_expression(P.a8(c, b, a.length, o, o))
            r = J.by(a)
            for (q = 0; q < b; ++q)
                if (!r.u()) throw H.wrap_expression(P.a8(b, 0, q, o, o))
            p = []
            if (s)
                for (; r.u();) p.push(r.gC())
            else
                for (q = b; q < c; ++q) {
                    if (!r.u()) throw H.wrap_expression(P.a8(c, b, q, o, o))
                    p.push(r.gC())
                }
            return H.nZ(p)
        },
        RegExp_RegExp(a) {
            return new H.JSSyntaxRegExp(a, H.JSSyntaxRegExp_makeNative(a, false, true, false, false, false))
        },
        o7(a, b, c) {
            var s = J.by(b)
            if (!s.u()) return a
            if (c.length === 0) {
                do a += H.as_string(s.gC())
                while (s.u())
            } else {
                a += H.as_string(s.gC())
                for (; s.u();) a = a + c + H.as_string(s.gC())
            }
            return a
        },
        rN(a) {
            var s = Math.abs(a),
                r = a < 0 ? "-" : ""
            if (s >= 1000) return "" + a
            if (s >= 100) return r + "0" + s
            if (s >= 10) return r + "00" + s
            return r + "000" + s
        },
        rO(a) {
            if (a >= 100) return "" + a
            if (a >= 10) return "0" + a
            return "00" + a
        },
        fk(a) {
            if (a >= 10) return "" + a
            return "0" + a
        },
        duration_milsec_sec(millsec, sec) {
            // a: milliseconds
            // b: seconds
            return new P.Duration(1e6 * sec + 1000 * millsec)
        },
        jh(a) {
            if (typeof a == "number" || H.lm(a) || a == null) return J.b4(a)
            if (typeof a == "string") return JSON.stringify(a)
            return P.Error__objectToString(a)
        },
        iP(a) {
            return new P.f2(a)
        },
        bz(a, b) {
            return new P.aS(false, null, b, a)
        },
        da(a, b, c) {
            return new P.aS(true, a, b, c)
        },
        tn(a) {
            var s = null
            return new P.cD(s, s, false, s, s, a)
        },
        k0(a, b) {
            return new P.cD(null, null, true, a, b, "Value not in range")
        },
        a8(a, b, c, d, e) {
            return new P.cD(b, c, true, a, d, "Invalid value")
        },
        tp(a, b, c, d) {
            if (a < b || a > c) throw H.wrap_expression(P.a8(a, b, c, d, null))
            return a
        },
        cE(a, b, c) {
            if (0 > a || a > c) throw H.wrap_expression(P.a8(a, 0, c, "start", null))
            if (b != null) {
                if (a > b || b > c) throw H.wrap_expression(P.a8(b, a, c, "end", null))
                return b
            }
            return c
        },
        to(a, b) {
            if (a < 0) throw H.wrap_expression(P.a8(a, 0, null, b, null))
            return a
        },
        ft(a, b, c, d, e) {
            var s = e == null ? J.aw(b) : e
            return new P.fs(s, true, a, c, "Index out of range")
        },
        UnsupportError(a) {
            return new P.hW(a)
        },
        hT(a) {
            return new P.hS(a)
        },
        cd(a) {
            return new P.bJ(a)
        },
        aK(a) {
            return new P.fh(a)
        },
        FormatException(a, b, c) {
            return new P.jm(a, b, c)
        },
        dq: function dq(a, b) {
            this.a = a
            this.b = b
        },
        Duration: function c1(a) {
            this.a = a
        },
        Duration_toString_sixDigits: function jc() { },
        Duration_toString_twoDigits: function jd() { },
        O: function O() { },
        f2: function f2(a) {
            this.a = a
        },
        bc: function bc() { },
        fL: function fL() { },
        aS: function aS(a, b, c, d) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
        },
        cD: function cD(a, b, c, d, e, f) {
            var _ = this
            _.e = a
            _.f = b
            _.a = c
            _.b = d
            _.c = e
            _.d = f
        },
        fs: function fs(a, b, c, d, e) {
            var _ = this
            _.f = a
            _.a = b
            _.b = c
            _.c = d
            _.d = e
        },
        hW: function hW(a) {
            this.a = a
        },
        hS: function hS(a) {
            this.a = a
        },
        bJ: function bJ(a) {
            this.a = a
        },
        fh: function fh(a) {
            this.a = a
        },
        fM: function fM() { },
        el: function el() { },
        fj: function fj(a) {
            this.a = a
        },
        kG: function kG(a) {
            this.a = a
        },
        jm: function jm(a, b, c) {
            this.a = a
            this.b = b
            this.c = c
        },
        L: function L() { },
        fv: function fv() { },
        N: function N() { },
        Object: function H() { },
        iq: function iq() { },
        cH: function cH(a) {
            this.a = a
        },
        my(a) {
            var s
            if (t.I.b(a)) {
                s = J.cm(a)
                if (s.constructor === Array)
                    if (typeof CanvasPixelArray !== "undefined") {
                        s.constructor = CanvasPixelArray
                        s.BYTES_PER_ELEMENT = 1
                    } return a
            }
            return new P.eJ(a.data, a.height, a.width)
        },
        uO(a) {
            if (a instanceof P.eJ) return {
                data: a.a,
                height: a.b,
                width: a.c
            }
            return a
        },
        m3() {
            return window.navigator.userAgent
        },
        _StructuredClone: function l4() { },
        l5: function l5(a, b) {
            this.a = a
            this.b = b
        },
        l6: function l6(a, b) {
            this.a = a
            this.b = b
        },
        kw: function kw() { },
        ky: function ky(a, b) {
            this.a = a
            this.b = b
        },
        eJ: function eJ(a, b, c) {
            this.a = a
            this.b = b
            this.c = c
        },
        _StructuredCloneDart2Js: function ir(a, b) {
            this.a = a
            this.b = b
        },
        kx: function kx(a, b) {
            this.a = a
            this.b = b
            this.c = false
        },
        vf(a, b) {
            var s = new P._Future($.P, b.i("U<0>")),
                r = new P.cg(s, b.i("cg<0>"))
            a.then(H.convert_dart_closure_to_js_md5(new P.lE(r), 1), H.convert_dart_closure_to_js_md5(new P.lF(r), 1))
            return s
        },
        jQ: function jQ(a) {
            this.a = a
        },
        lE: function lE(a) {
            this.a = a
        },
        lF: function lF(a) {
            this.a = a
        },
        o_() {
            return C.F
        },
        kT: function kT() { },
        cF: function cF() { },
        p: function p() { }
    },
    S = {
        fK: function fK() { }
    },
    T = {
        ty(a, b, c, d, e) {
            var s, r, q, p = 0
            if (c > p && !(a.fx <= p)) {
                s = C.JsInt.P(c + $.i(), $.t())
                p = a.fy
                r = a.fx
                q = p - r
                if (s > q) s = q
                a.fx = r + s
                p = LangData.get_lang("imin")
                r = new T.HPlr(r)
                r.a = a.e
                r.d = a.fx
                e.a.push(T.RunUpdate(p, a, r, new T.HRecover(s), null, s, 1000, 100))
            }
        },
        nC(a) {
            var s = new T.dd($.i(), 0)
            s.r = a
            return s
        },
        tA(a, b, c, d, e) {
            var s, r = 0
            if (c > r && !(b.fx <= r)) {
                if (b.a7($.aJ(), d)) return
                s = t.aJ.a(b.r2.h(0, $.aJ()))
                if (s == null) {
                    s = T.nC(b)
                    s.aP(0)
                    e.a.push(T.RunUpdate(C.String.B(LangData.get_lang("jIRA"), $.nc()), a, b, null, null, $.a6(), 1000, 100))
                } else s.fr = s.fr + 1
                if (a.r2.J(0, $.a7())) s.fr = s.fr + 1
            }
        },
        nG(a, b) {
            var s = new T.dj(a, b, $.i())
            s.y = new T.b8(s)
            return s
        },
        fD(a) {
            var s, r, q
            for (s = t.fM; s.b(a);) a = a.gap()
            s = a.r2
            r = t.f5.a(s.h(0, $.na()))
            if (r == null) {
                r = new T.dI(0)
                s.m(0, $.na(), r)
            }
            s = H.as_string(a.a) + "?"
            q = r.b
            r.b = q + 1
            return s + H.as_string(q) + "@" + H.as_string(a.b)
        },
        nU(a4) {
            var s, r, q, p, o, n, m, l, k, j, i, h, g, f = a4.a,
                e = a4.b,
                d = a4.c,
                c = a4.d,
                b = 0,
                a = $.T(),
                a0 = H.b([], t.q),
                a1 = H.b([], t.H),
                a2 = P.a0(t.X, t.W),
                a3 = new Sgls.c(t.n)
            a3.c = a3
            a3.b = a3
            s = new Sgls.c(t.p)
            s.c = s
            s.b = s
            r = new Sgls.c(t.g)
            r.c = r
            r.b = r
            q = new Sgls.c(t.G)
            q.c = q
            q.b = q
            p = new Sgls.c(t._)
            p.c = p
            p.b = p
            o = new Sgls.c(t.e)
            o.c = o
            o.b = o
            n = new Sgls.c(t.k)
            n.c = n
            n.b = n
            m = new Sgls.c(t.l)
            m.c = m
            m.b = m
            l = new Sgls.c(t.m)
            l.c = l
            l.b = l
            k = t.i
            j = H.b([], k)
            i = H.b([], k)
            h = H.b([], k)
            k = H.b([], k)
            g = 0
            g = new T.dR(f, e, d, c, b, a, a0, a1, a2, a3, s, r, q, p, o, n, m, l, j, i, h, k, g, g, g, $.W(), g)
            g.a1(f, e, d, c)
            g.cm = a4
            g.e = T.fD(a4 instanceof T.dR ? g.a6 = a4.a6 : g.a6 = a4)
            f = a4.t
            f = H.b(f.slice(0), H._arrayInstanceType(f))
            g.t = f
            return g
        },
        tC(a, b, c, d, e) {
            var s, r = 0
            if (c > r && !(b.fx <= r)) {
                if (b.a7($.bh(), d)) return
                r = b.r2
                s = t.dK.a(r.h(0, $.bh()))
                if (s == null) {
                    s = new T.dn(a, b, $.pK(), $.t())
                    s.y = new T.bd(s)
                    r.m(0, $.bh(), s)
                    b.y2.j(0, s)
                    b.rx.j(0, s.y)
                    b.F()
                } else {
                    s.z = s.z + $.Z()
                    s.Q = s.Q + 1
                }
                if (r.h(0, $.a7()) != null) {
                    s.z = s.z + $.Z()
                    s.Q = s.Q + 1
                }
                e.a.push(T.RunUpdate(C.String.B(LangData.get_lang("spfN"), $.qx()), a, b, null, null, $.a6(), 1000, 100))
            }
        },
        tD(a, b, c, d, e) {
            var s, r, q, p, o
            if (c > 0) {
                s = b.r2
                r = s.gad(s)
                q = P.List_List_of(r, true, H._instanceType(r).i("L.E"))
                C.Array.aJ(q)
                for (r = q.length, p = 0; p < q.length; q.length === r || (0, H.F)(q), ++p) {
                    o = s.h(0, q[p])
                    if (o.gT() > 0) o.K(a, e)
                }
                s = b.go
                r = $.au()
                if (s > r) b.go = s - r
                else {
                    r = $.at()
                    if (s > r) b.go = 0
                    else b.go = s - r
                }
            }
        },
        tE(a, b, c, d, e) {
            var s, r = 0
            if (c > r && !(b.fx <= r)) {
                if (b.a7($.eY(), d)) return
                r = b.r2
                s = t.a.a(r.h(0, $.eY()))
                if (s == null) {
                    s = new T.c3($.ao())
                    r.m(0, $.eY(), s)
                }
                s.b = s.b + $.b0()
            }
        },
        tF(a, b, c, d, e) {
            var s, r = 0
            if (c > r && !(b.fx <= r)) {
                if (b.a7($.bS(), d)) return
                r = b.r2
                s = t.ck.a(r.h(0, $.bS()))
                if (s == null) {
                    s = new T.dx(b, $.cX())
                    s.x = new T.fY(s)
                    r.m(0, $.bS(), s)
                    b.rx.j(0, s)
                    b.ry.j(0, s.x)
                    b.F()
                } else s.y = s.y + $.cX()
                if (a.r2.J(0, $.a7())) s.y = s.y + $.bx()
                r = T.RunUpdate(C.String.B(LangData.get_lang("HBga"), $.qF()), a, b, null, null, $.bg(), 1000, 100)
                e.a.push(r)
            }
        },
        tI(a, b, c, d, e) {
            var s, r
            if (c > $.C() && !(b.fx <= 0)) {
                if (b.a7($.bT(), d)) return
                s = b.r2
                r = t.ax.a(s.h(0, $.bT()))
                if (r == null) {
                    r = new T.dS(a, b, $.C())
                    r.y = T.I(a, true, d) * $.eV()
                    s.m(0, $.bT(), r)
                    b.x2.j(0, r)
                } else {
                    r.y = r.y + T.I(a, true, d) * $.eV()
                    r.z = $.C()
                    r.r = a
                }
                e.a.push(T.RunUpdate(C.String.B(LangData.get_lang("Okln"), $.qH()), a, b, null, null, $.a6(), 1000, 100))
            }
        },
        I(a, b, c) {
            var s, r, q, p, o = b ? a.dx : a.ch,
                n = t.i,
                m = H.b([c.n() & 127, c.n() & 127, c.n() & 127, o + $.au(), o], n)
            C.Array.aJ(m)
            s = m[$.t()]
            m = c.n()
            r = $.au()
            q = c.n()
            p = $.au()
            n = H.b([(m & 63) + r, (q & 63) + p, o + p], n)
            C.Array.aJ(n)
            return s * n[$.i()] * a.id
        },
        d9(a, b, c) {
            if (b) return a.dy + $.au()
            return a.cx + $.au()
        },
        bW(a, b, c) {
            var s = $.eW() + b - a,
                r = $.ap()
            if (s < r) s = r
            if (s > $.au()) s = C.JsInt.P(s, $.C()) + $.aI()
            return c.n() <= s
        },
        f_(a) {
            var s = a.fx
            if (s < $.as()) return $.pz()
            if (s > $.mR()) return $.py()
            return s
        },
        init_boss(name, clan_name, fgt, weapon_name) {
            // MARK: WTF 什么鬼这么长
            var s, r, q, p, o, n, m, l, k, j, i, h, g, f, e, d, c, b, a, a0, a1, a2, a3 = null
            if (clan_name == $.nk()) {
                s = 0
                r = $.T()
                q = H.b([], t.q)
                p = H.b([], t.H)
                o = P.a0(t.X, t.W)
                n = new Sgls.c(t.n)
                n.c = n
                n.b = n
                m = new Sgls.c(t.p)
                m.c = m
                m.b = m
                l = new Sgls.c(t.g)
                l.c = l
                l.b = l
                k = new Sgls.c(t.G)
                k.c = k
                k.b = k
                j = new Sgls.c(t._)
                j.c = j
                j.b = j
                i = new Sgls.c(t.e)
                i.c = i
                i.b = i
                h = new Sgls.c(t.k)
                h.c = h
                h.b = h
                g = new Sgls.c(t.l)
                g.c = g
                g.b = g
                f = new Sgls.c(t.m)
                f.c = f
                f.b = f
                e = t.i
                d = H.b([], e)
                c = H.b([], e)
                b = H.b([], e)
                e = H.b([], e)
                a = 0
                a = new T.PlrBossTest(name, clan_name, name, a3, s, r, q, p, o, n, m, l, k, j, i, h, g, f, d, c, b, e, a, a, a, $.W(), a)
                a.a1(name, clan_name, name, a3)
                a.e4(name, clan_name, fgt)
                return a
            }
            // MARK: BOSS INIT(上面也是)
            if (clan_name == $.qR()) {
                s = 0
                r = $.T()
                q = H.b([], t.q)
                p = H.b([], t.H)
                o = P.a0(t.X, t.W)
                n = new Sgls.c(t.n)
                n.c = n
                n.b = n
                m = new Sgls.c(t.p)
                m.c = m
                m.b = m
                l = new Sgls.c(t.g)
                l.c = l
                l.b = l
                k = new Sgls.c(t.G)
                k.c = k
                k.b = k
                j = new Sgls.c(t._)
                j.c = j
                j.b = j
                i = new Sgls.c(t.e)
                i.c = i
                i.b = i
                h = new Sgls.c(t.k)
                h.c = h
                h.b = h
                g = new Sgls.c(t.l)
                g.c = g
                g.b = g
                f = new Sgls.c(t.m)
                f.c = f
                f.b = f
                e = t.i
                d = H.b([], e)
                c = H.b([], e)
                b = H.b([], e)
                e = H.b([], e)
                a = 0
                a = new T.PlrBossTest2(name, clan_name, name, a3, s, r, q, p, o, n, m, l, k, j, i, h, g, f, d, c, b, e, a, a, a, $.W(), a)
                a.a1(name, clan_name, name, a3)
                a.e5(name, clan_name)
                return a
            }
            // MARK: 强评?
            // cl -> !
            s = $.cl()
            if (clan_name == s) {
                if (name == $.lQ()) {
                    r = 0
                    q = H.as_string(name) + H.as_string($.aD())
                    p = 0
                    o = $.T()
                    n = H.b([], t.q)
                    m = H.b([], t.H)
                    l = P.a0(t.X, t.W)
                    k = new Sgls.c(t.n)
                    k.c = k
                    k.b = k
                    j = new Sgls.c(t.p)
                    j.c = j
                    j.b = j
                    i = new Sgls.c(t.g)
                    i.c = i
                    i.b = i
                    h = new Sgls.c(t.G)
                    h.c = h
                    h.b = h
                    g = new Sgls.c(t._)
                    g.c = g
                    g.b = g
                    f = new Sgls.c(t.e)
                    f.c = f
                    f.b = f
                    e = new Sgls.c(t.k)
                    e.c = e
                    e.b = e
                    d = new Sgls.c(t.l)
                    d.c = d
                    d.b = d
                    c = new Sgls.c(t.m)
                    c.c = c
                    c.b = c
                    b = t.i
                    a = H.b([], b)
                    a0 = H.b([], b)
                    a1 = H.b([], b)
                    b = H.b([], b)
                    a2 = 0
                    a2 = new T.df(r, name, s, q, a3, p, o, n, m, l, k, j, i, h, g, f, e, d, c, a, a0, a1, b, a2, a2, a2, $.W(), a2)
                    a2.a1(name, s, q, a3)
                    a2.av(name, s)
                    return a2
                }
                if (name == $.qP()) {
                    r = H.as_string(name) + H.as_string($.aD())
                    q = 0
                    p = $.T()
                    o = H.b([], t.q)
                    n = H.b([], t.H)
                    m = P.a0(t.X, t.W)
                    l = new Sgls.c(t.n)
                    l.c = l
                    l.b = l
                    k = new Sgls.c(t.p)
                    k.c = k
                    k.b = k
                    j = new Sgls.c(t.g)
                    j.c = j
                    j.b = j
                    i = new Sgls.c(t.G)
                    i.c = i
                    i.b = i
                    h = new Sgls.c(t._)
                    h.c = h
                    h.b = h
                    g = new Sgls.c(t.e)
                    g.c = g
                    g.b = g
                    f = new Sgls.c(t.k)
                    f.c = f
                    f.b = f
                    e = new Sgls.c(t.l)
                    e.c = e
                    e.b = e
                    d = new Sgls.c(t.m)
                    d.c = d
                    d.b = d
                    c = t.i
                    b = H.b([], c)
                    a = H.b([], c)
                    a0 = H.b([], c)
                    c = H.b([], c)
                    a1 = 0
                    a1 = new T.fc(name, s, r, a3, q, p, o, n, m, l, k, j, i, h, g, f, e, d, b, a, a0, c, a1, a1, a1, $.W(), a1)
                    a1.a1(name, s, r, a3)
                    a1.av(name, s)
                    return a1
                }
                if (name == $.qo()) {
                    r = H.as_string(name) + H.as_string($.aD())
                    q = 0
                    p = $.T()
                    o = H.b([], t.q)
                    n = H.b([], t.H)
                    m = P.a0(t.X, t.W)
                    l = new Sgls.c(t.n)
                    l.c = l
                    l.b = l
                    k = new Sgls.c(t.p)
                    k.c = k
                    k.b = k
                    j = new Sgls.c(t.g)
                    j.c = j
                    j.b = j
                    i = new Sgls.c(t.G)
                    i.c = i
                    i.b = i
                    h = new Sgls.c(t._)
                    h.c = h
                    h.b = h
                    g = new Sgls.c(t.e)
                    g.c = g
                    g.b = g
                    f = new Sgls.c(t.k)
                    f.c = f
                    f.b = f
                    e = new Sgls.c(t.l)
                    e.c = e
                    e.b = e
                    d = new Sgls.c(t.m)
                    d.c = d
                    d.b = d
                    c = t.i
                    b = H.b([], c)
                    a = H.b([], c)
                    a0 = H.b([], c)
                    c = H.b([], c)
                    a1 = 0
                    a1 = new T.f9(name, s, r, a3, q, p, o, n, m, l, k, j, i, h, g, f, e, d, b, a, a0, c, a1, a1, a1, $.W(), a1)
                    a1.a1(name, s, r, a3)
                    a1.av(name, s)
                    return a1
                }
                if (name == $.qY()) {
                    r = H.as_string(name) + H.as_string($.aD())
                    q = 0
                    p = $.T()
                    o = H.b([], t.q)
                    n = H.b([], t.H)
                    m = P.a0(t.X, t.W)
                    l = new Sgls.c(t.n)
                    l.c = l
                    l.b = l
                    k = new Sgls.c(t.p)
                    k.c = k
                    k.b = k
                    j = new Sgls.c(t.g)
                    j.c = j
                    j.b = j
                    i = new Sgls.c(t.G)
                    i.c = i
                    i.b = i
                    h = new Sgls.c(t._)
                    h.c = h
                    h.b = h
                    g = new Sgls.c(t.e)
                    g.c = g
                    g.b = g
                    f = new Sgls.c(t.k)
                    f.c = f
                    f.b = f
                    e = new Sgls.c(t.l)
                    e.c = e
                    e.b = e
                    d = new Sgls.c(t.m)
                    d.c = d
                    d.b = d
                    c = t.i
                    b = H.b([], c)
                    a = H.b([], c)
                    a0 = H.b([], c)
                    c = H.b([], c)
                    a1 = 0
                    a1 = new T.fd(name, s, r, a3, q, p, o, n, m, l, k, j, i, h, g, f, e, d, b, a, a0, c, a1, a1, a1, $.W(), a1)
                    a1.a1(name, s, r, a3)
                    a1.av(name, s)
                    return a1
                }
                if (name == $.qO()) return T.rE(name, s)
                if (name == $.qh()) {
                    r = H.as_string(name) + H.as_string($.aD())
                    q = 0
                    p = $.T()
                    o = H.b([], t.q)
                    n = H.b([], t.H)
                    m = P.a0(t.X, t.W)
                    l = new Sgls.c(t.n)
                    l.c = l
                    l.b = l
                    k = new Sgls.c(t.p)
                    k.c = k
                    k.b = k
                    j = new Sgls.c(t.g)
                    j.c = j
                    j.b = j
                    i = new Sgls.c(t.G)
                    i.c = i
                    i.b = i
                    h = new Sgls.c(t._)
                    h.c = h
                    h.b = h
                    g = new Sgls.c(t.e)
                    g.c = g
                    g.b = g
                    f = new Sgls.c(t.k)
                    f.c = f
                    f.b = f
                    e = new Sgls.c(t.l)
                    e.c = e
                    e.b = e
                    d = new Sgls.c(t.m)
                    d.c = d
                    d.b = d
                    c = t.i
                    b = H.b([], c)
                    a = H.b([], c)
                    a0 = H.b([], c)
                    c = H.b([], c)
                    a1 = 0
                    a1 = new T.f8(name, s, r, a3, q, p, o, n, m, l, k, j, i, h, g, f, e, d, b, a, a0, c, a1, a1, a1, $.W(), a1)
                    a1.a1(name, s, r, a3)
                    a1.av(name, s)
                    return a1
                }
                if (name == $.qb()) {
                    r = H.as_string(name) + H.as_string($.aD())
                    q = 0
                    p = $.T()
                    o = H.b([], t.q)
                    n = H.b([], t.H)
                    m = P.a0(t.X, t.W)
                    l = new Sgls.c(t.n)
                    l.c = l
                    l.b = l
                    k = new Sgls.c(t.p)
                    k.c = k
                    k.b = k
                    j = new Sgls.c(t.g)
                    j.c = j
                    j.b = j
                    i = new Sgls.c(t.G)
                    i.c = i
                    i.b = i
                    h = new Sgls.c(t._)
                    h.c = h
                    h.b = h
                    g = new Sgls.c(t.e)
                    g.c = g
                    g.b = g
                    f = new Sgls.c(t.k)
                    f.c = f
                    f.b = f
                    e = new Sgls.c(t.l)
                    e.c = e
                    e.b = e
                    d = new Sgls.c(t.m)
                    d.c = d
                    d.b = d
                    c = t.i
                    b = H.b([], c)
                    a = H.b([], c)
                    a0 = H.b([], c)
                    c = H.b([], c)
                    a1 = 0
                    a1 = new T.f6(name, s, r, a3, q, p, o, n, m, l, k, j, i, h, g, f, e, d, b, a, a0, c, a1, a1, a1, $.W(), a1)
                    a1.a1(name, s, r, a3)
                    a1.av(name, s)
                    return a1
                }
                if (name == $.q9()) {
                    r = H.as_string(name) + H.as_string($.aD())
                    q = 0
                    p = $.T()
                    o = H.b([], t.q)
                    n = H.b([], t.H)
                    m = P.a0(t.X, t.W)
                    l = new Sgls.c(t.n)
                    l.c = l
                    l.b = l
                    k = new Sgls.c(t.p)
                    k.c = k
                    k.b = k
                    j = new Sgls.c(t.g)
                    j.c = j
                    j.b = j
                    i = new Sgls.c(t.G)
                    i.c = i
                    i.b = i
                    h = new Sgls.c(t._)
                    h.c = h
                    h.b = h
                    g = new Sgls.c(t.e)
                    g.c = g
                    g.b = g
                    f = new Sgls.c(t.k)
                    f.c = f
                    f.b = f
                    e = new Sgls.c(t.l)
                    e.c = e
                    e.b = e
                    d = new Sgls.c(t.m)
                    d.c = d
                    d.b = d
                    c = t.i
                    b = H.b([], c)
                    a = H.b([], c)
                    a0 = H.b([], c)
                    c = H.b([], c)
                    a1 = 0
                    a1 = new T.f5(name, s, r, a3, q, p, o, n, m, l, k, j, i, h, g, f, e, d, b, a, a0, c, a1, a1, a1, $.W(), a1)
                    a1.a1(name, s, r, a3)
                    a1.av(name, s)
                    return a1
                }
                if (name == $.d5()) {
                    r = H.as_string(name) + H.as_string($.aD())
                    q = 0
                    p = $.T()
                    o = H.b([], t.q)
                    n = H.b([], t.H)
                    m = P.a0(t.X, t.W)
                    l = new Sgls.c(t.n)
                    l.c = l
                    l.b = l
                    k = new Sgls.c(t.p)
                    k.c = k
                    k.b = k
                    j = new Sgls.c(t.g)
                    j.c = j
                    j.b = j
                    i = new Sgls.c(t.G)
                    i.c = i
                    i.b = i
                    h = new Sgls.c(t._)
                    h.c = h
                    h.b = h
                    g = new Sgls.c(t.e)
                    g.c = g
                    g.b = g
                    f = new Sgls.c(t.k)
                    f.c = f
                    f.b = f
                    e = new Sgls.c(t.l)
                    e.c = e
                    e.b = e
                    d = new Sgls.c(t.m)
                    d.c = d
                    d.b = d
                    c = t.i
                    b = H.b([], c)
                    a = H.b([], c)
                    a0 = H.b([], c)
                    c = H.b([], c)
                    a1 = 0
                    a1 = new T.de(name, s, r, a3, q, p, o, n, m, l, k, j, i, h, g, f, e, d, b, a, a0, c, a1, a1, a1, $.W(), a1)
                    a1.a1(name, s, r, a3)
                    a1.av(name, s)
                    return a1
                }
                // covid
                if (name == $.ck()) {
                    r = H.as_string(name) + H.as_string($.aD())
                    q = 0
                    p = $.T()
                    o = H.b([], t.q)
                    n = H.b([], t.H)
                    m = P.a0(t.X, t.W)
                    l = new Sgls.c(t.n)
                    l.c = l
                    l.b = l
                    k = new Sgls.c(t.p)
                    k.c = k
                    k.b = k
                    j = new Sgls.c(t.g)
                    j.c = j
                    j.b = j
                    i = new Sgls.c(t.G)
                    i.c = i
                    i.b = i
                    h = new Sgls.c(t._)
                    h.c = h
                    h.b = h
                    g = new Sgls.c(t.e)
                    g.c = g
                    g.b = g
                    f = new Sgls.c(t.k)
                    f.c = f
                    f.b = f
                    e = new Sgls.c(t.l)
                    e.c = e
                    e.b = e
                    d = new Sgls.c(t.m)
                    d.c = d
                    d.b = d
                    c = t.i
                    b = H.b([], c)
                    a = H.b([], c)
                    a0 = H.b([], c)
                    c = H.b([], c)
                    a1 = 0
                    a1 = new T.PlrBossCovid(name, s, r, a3, q, p, o, n, m, l, k, j, i, h, g, f, e, d, b, a, a0, c, a1, a1, a1, $.W(), a1)
                    a1.a1(name, s, r, a3)
                    a1.av(name, s)
                    return a1
                }
                if (name == $.qL()) {
                    r = H.as_string(name) + H.as_string($.aD())
                    q = 0
                    p = $.T()
                    o = H.b([], t.q)
                    n = H.b([], t.H)
                    m = P.a0(t.X, t.W)
                    l = new Sgls.c(t.n)
                    l.c = l
                    l.b = l
                    k = new Sgls.c(t.p)
                    k.c = k
                    k.b = k
                    j = new Sgls.c(t.g)
                    j.c = j
                    j.b = j
                    i = new Sgls.c(t.G)
                    i.c = i
                    i.b = i
                    h = new Sgls.c(t._)
                    h.c = h
                    h.b = h
                    g = new Sgls.c(t.e)
                    g.c = g
                    g.b = g
                    f = new Sgls.c(t.k)
                    f.c = f
                    f.b = f
                    e = new Sgls.c(t.l)
                    e.c = e
                    e.b = e
                    d = new Sgls.c(t.m)
                    d.c = d
                    d.b = d
                    c = t.i
                    b = H.b([], c)
                    a = H.b([], c)
                    a0 = H.b([], c)
                    c = H.b([], c)
                    a1 = 0
                    a1 = new T.fa(name, s, r, a3, q, p, o, n, m, l, k, j, i, h, g, f, e, d, b, a, a0, c, a1, a1, a1, $.W(), a1)
                    a1.a1(name, s, r, a3)
                    a1.av(name, s)
                    return a1
                }
                r = $.ni()
                if (J.m1(name, r)) {
                    r = H.as_string(r) + H.as_string($.aD())
                    q = 0
                    p = $.T()
                    o = H.b([], t.q)
                    n = H.b([], t.H)
                    m = P.a0(t.X, t.W)
                    l = new Sgls.c(t.n)
                    l.c = l
                    l.b = l
                    k = new Sgls.c(t.p)
                    k.c = k
                    k.b = k
                    j = new Sgls.c(t.g)
                    j.c = j
                    j.b = j
                    i = new Sgls.c(t.G)
                    i.c = i
                    i.b = i
                    h = new Sgls.c(t._)
                    h.c = h
                    h.b = h
                    g = new Sgls.c(t.e)
                    g.c = g
                    g.b = g
                    f = new Sgls.c(t.k)
                    f.c = f
                    f.b = f
                    e = new Sgls.c(t.l)
                    e.c = e
                    e.b = e
                    d = new Sgls.c(t.m)
                    d.c = d
                    d.b = d
                    c = t.i
                    b = H.b([], c)
                    a = H.b([], c)
                    a0 = H.b([], c)
                    c = H.b([], c)
                    a1 = 0
                    a1 = new T.fR(name, s, r, a3, q, p, o, n, m, l, k, j, i, h, g, f, e, d, b, a, a0, c, a1, a1, a1, $.W(), a1)
                    a1.a1(name, s, r, a3)
                    r = a1.r = C.String.ay(name, $.X())
                    s = $.C()
                    $.vq = r.length > s && C.String.a8(r, s) === $.q0() ? $.pE() : $.mS()
                    return a1
                }
                if ($.nr().J(0, name)) {
                    s = $.cl()
                    r = $.nr().h(0, name)
                    q = 0
                    p = $.T()
                    o = H.b([], t.q)
                    n = H.b([], t.H)
                    m = P.a0(t.X, t.W)
                    l = new Sgls.c(t.n)
                    l.c = l
                    l.b = l
                    k = new Sgls.c(t.p)
                    k.c = k
                    k.b = k
                    j = new Sgls.c(t.g)
                    j.c = j
                    j.b = j
                    i = new Sgls.c(t.G)
                    i.c = i
                    i.b = i
                    h = new Sgls.c(t._)
                    h.c = h
                    h.b = h
                    g = new Sgls.c(t.e)
                    g.c = g
                    g.b = g
                    f = new Sgls.c(t.k)
                    f.c = f
                    f.b = f
                    e = new Sgls.c(t.l)
                    e.c = e
                    e.b = e
                    d = new Sgls.c(t.m)
                    d.c = d
                    d.b = d
                    c = t.i
                    b = H.b([], c)
                    a = H.b([], c)
                    a0 = H.b([], c)
                    c = H.b([], c)
                    a1 = 0
                    a1 = new T.fP(r, name, s, name, weapon_name, q, p, o, n, m, l, k, j, i, h, g, f, e, d, b, a, a0, c, a1, a1, a1, $.W(), a1)
                    a1.a1(name, s, name, weapon_name)
                    a1.e1(name, s, r, weapon_name)
                    return a1
                }
                s = $.cl()
                r = 0
                q = $.T()
                p = H.b([], t.q)
                o = H.b([], t.H)
                n = P.a0(t.X, t.W)
                m = new Sgls.c(t.n)
                m.c = m
                m.b = m
                l = new Sgls.c(t.p)
                l.c = l
                l.b = l
                k = new Sgls.c(t.g)
                k.c = k
                k.b = k
                j = new Sgls.c(t.G)
                j.c = j
                j.b = j
                i = new Sgls.c(t._)
                i.c = i
                i.b = i
                h = new Sgls.c(t.e)
                h.c = h
                h.b = h
                g = new Sgls.c(t.k)
                g.c = g
                g.b = g
                f = new Sgls.c(t.l)
                f.c = f
                f.b = f
                e = new Sgls.c(t.m)
                e.c = e
                e.b = e
                d = t.i
                c = H.b([], d)
                b = H.b([], d)
                a = H.b([], d)
                d = H.b([], d)
                a0 = 0
                a0 = new T.fQ(name, s, name, weapon_name, r, q, p, o, n, m, l, k, j, i, h, g, f, e, c, b, a, d, a0, a0, a0, $.W(), a0)
                a0.a1(name, s, name, weapon_name)
                a0.e2(name, s, name, weapon_name)
                return a0
            }
            return T.nT(name, clan_name, a3, weapon_name)
        },
        oq(a) {
            var s = a.d
            if (s != null) s = C.String.cl(s, $.qm()) || C.String.cl(s, $.qn())
            else s = false
            return s
        },
        j7(a, b, c, d, e) {
            var s, r, q, p, o, n = b.r2,
                m = t.cu,
                l = m.a(n.h(0, $.ck()))
            if (l != null) s = l.b && !l.c.w(0, c)
            else s = true
            if (s) {
                s = 0
                r = new T.dl(a, b, s, c, s)
                r.k1 = new T.b8(r)
                r.k2 = new T.ca(r)
                m = m.a(n.h(0, $.ck()))
                r.id = m
                s = r.go
                if (m != null) m.c.j(0, s)
                else {
                    m = P.c5(t.B)
                    q = new T.dk(m)
                    m.j(0, s)
                    r.id = q
                    n.m(0, $.ck(), q)
                }
                b.x2.j(0, r.k1)
                b.x1.j(0, r.k2)
                b.F()
                e.a.push(T.RunUpdate(LangData.get_lang("toAn"), a, b, null, null, 0, 1000, 100))
                for (n = a.y.a.e, m = n.length, p = 0; p < n.length; n.length === m || (0, H.F)(n), ++p) {
                    o = n[p]
                    // if (J.Y(o, b)) {
                    if (o === b) {
                        o.l = o.l + $.bx()
                    } else {
                        o.l = o.l - $.eX()
                    }
                }
                return true
            }
            return false
        },
        tB(a, b, c, d, e) {
            if (b.r2.h(0, $.ck()) == null && (d.n() & 63) + 1 < c) T.j7(a, b, $.bg(), d, e)
        },
        nO(a, b) {
            var s = new T.dB(a, b, 0)
            s.fy = new T.b8(s)
            s.go = new T.bd(s)
            s.id = new T.ca(s)
            return s
        },
        nP(a, b, c) {
            var s, r = null,
                q = 1000,
                p = b.n()
            if (p < $.b1()) {
                s = c.a
                s.push(T.RunUpdate(LangData.get_lang("yZbn"), a, r, r, r, 0, q, 100))
            } else if (p < $.ci()) {
                s = c.a
                s.push(T.RunUpdate(LangData.get_lang("PdCA"), a, r, r, r, 0, q, 100))
            } else if (p < $.mJ()) {
                s = c.a
                s.push(T.RunUpdate(LangData.get_lang("gjTN"), a, r, r, r, 0, q, 100))
            } else if (p < $.pc()) {
                s = c.a
                s.push(T.RunUpdate(LangData.get_lang("xraA"), a, r, r, r, 0, q, 100))
            } else {
                s = c.a
                if (p < $.pp()) s.push(T.RunUpdate(LangData.get_lang("OBXn"), a, r, r, r, 0, q, 100))
                else s.push(T.RunUpdate(LangData.get_lang("fNKA"), a, r, r, r, 0, q, 100))
            }
            s.push(T.RunUpdate(LangData.get_lang("hXqA"), a, r, r, r, 0, q, 100))
        },
        tG(a, b, c, d, e) {
            if (t.r.a(b.r2.h(0, $.d5())) == null && !(b instanceof T.de)) {
                T.nO(a, b).aP(0)
                e.a.push(T.RunUpdate(LangData.get_lang("JnTA"), a, b, null, null, 0, 1000, 100))
            }
        },
        tH(a, b) {
            var s = new T.ea(b, 0)
            s.r = a
            return s
        },
        rE(a2, a3) {
            var s, r, q, p, o, n, m, l, k, j, i, h, g, f = 0,
                e = H.as_string(a2) + H.as_string($.aD()),
                d = 0,
                c = $.T(),
                b = H.b([], t.q),
                a = H.b([], t.H),
                a0 = P.a0(t.X, t.W),
                a1 = new Sgls.c(t.n)
            a1.c = a1
            a1.b = a1
            s = new Sgls.c(t.p)
            s.c = s
            s.b = s
            r = new Sgls.c(t.g)
            r.c = r
            r.b = r
            q = new Sgls.c(t.G)
            q.c = q
            q.b = q
            p = new Sgls.c(t._)
            p.c = p
            p.b = p
            o = new Sgls.c(t.e)
            o.c = o
            o.b = o
            n = new Sgls.c(t.k)
            n.c = n
            n.b = n
            m = new Sgls.c(t.l)
            m.c = m
            m.b = m
            l = new Sgls.c(t.m)
            l.c = l
            l.b = l
            k = t.i
            j = H.b([], k)
            i = H.b([], k)
            h = H.b([], k)
            k = H.b([], k)
            g = 0
            g = new T.PlrBossSlime(f, a2, a3, e, null, d, c, b, a, a0, a1, s, r, q, p, o, n, m, l, j, i, h, k, g, g, g, $.W(), g)
            g.a1(a2, a3, e, null)
            g.av(a2, a3)
            return g
        },
        nD(a2, a3, a4) {
            var s, r, q, p, o, n, m, l, k, j, i, h, g, f = 0,
                e = H.as_string(a3) + H.as_string($.aD()),
                d = 0,
                c = $.T(),
                b = H.b([], t.q),
                a = H.b([], t.H),
                a0 = P.a0(t.X, t.W),
                a1 = new Sgls.c(t.n)
            a1.c = a1
            a1.b = a1
            s = new Sgls.c(t.p)
            s.c = s
            s.b = s
            r = new Sgls.c(t.g)
            r.c = r
            r.b = r
            q = new Sgls.c(t.G)
            q.c = q
            q.b = q
            p = new Sgls.c(t._)
            p.c = p
            p.b = p
            o = new Sgls.c(t.e)
            o.c = o
            o.b = o
            n = new Sgls.c(t.k)
            n.c = n
            n.b = n
            m = new Sgls.c(t.l)
            m.c = m
            m.b = m
            l = new Sgls.c(t.m)
            l.c = l
            l.b = l
            k = t.i
            j = H.b([], k)
            i = H.b([], k)
            h = H.b([], k)
            k = H.b([], k)
            g = 0
            g = new T.fb(a2, f, a3, a4, e, null, d, c, b, a, a0, a1, s, r, q, p, o, n, m, l, j, i, h, k, g, g, g, $.W(), g)
            g.a1(a3, a4, e, null)
            g.av(a3, a4)
            g.e = T.fD(a2)
            g.eV()
            return g
        },
        parse_names(a) {
            var s, r, q, p, o, n, m, l, k, j, i, h, g, f, e = null,
                d = t.E,
                c = H.b([], d),
                b = C.String.cK(a, $.r_())
            for (s = 0; s < b.length; ++s) {
                r = b[s]
                q = $.r0()
                r.toString
                r = H.iG(r, q, " ", 0)
                q = $.nq()
                b[s] = H.iG(r, q, "", 0)
            }
            // for (; J.Y(C.Array.gbl(b), "");) {
            for (; C.Array.gbl(b) === "";) {
                b.pop()
                if (b.length === 0) return H.b([], d)
            }
            p = C.Array.w(b, "") && true
            d = t.t
            o = H.b([], d)
            for (s = 0, r = t.V, q = !p, n = e; s < b.length; ++s) {
                m = b[s]
                if (m === "") {
                    if (o.length !== 0) c.push(o)
                    o = H.b([], d)
                    n = e
                    continue
                }
                if (q) {
                    if (o.length !== 0) c.push(o)
                    o = H.b([], d)
                }
                // if includes "+"
                // weapon
                l = $.lO()
                m.toString
                // if (l == null) H.throw_expression(H.R(l))
                // if (H.iF(m, l, 0)) {
                if (m.includes("+")) {
                    k = C.String.aT(m, $.lO())
                    // j = C.String.dF(C.String.ay(m, k + $.i()))
                    j = C.String.trim_name(C.String.ay(m, k + $.i()))
                    l = C.String.af(m, 0, k)
                    i = $.nq()
                    m = H.iG(l, i, "", 0)
                } else {
                    j = e
                }
                // console.log("weapon: " + j)
                l = $.n3()
                if (l == null) H.throw_expression(H.R(l))
                if (H.iF(m, l, 0)) {
                    h = C.String.cK(m, $.n3())
                    if (J.m1(h[0], " ")) {
                        l = 0
                        h[l] = J.nB(h[l], $.i())
                    }
                    if (!J.Y(h[$.i()], "")) {
                        l = h[$.i()]
                        i = $.n5()
                        l.toString
                        if (i == null) H.throw_expression(H.R(i))
                        g = J.a3(l)
                        f = g.gp(l)
                        if (0 > f) H.throw_expression(P.a8(0, 0, g.gp(l), e, e))
                        l = H.iF(l, i, 0)
                    } else l = true
                    if (l) o.push(H.b([h[0], null, j], r))
                    else o.push(H.b([h[0], h[$.i()], j], r))
                } else if (C.String.bA(m, " ")) {
                    o.push(H.b([C.String.ay(m, $.i()), n, j], r))
                } else {
                    if (s + $.i() < b.length) {
                        l = $.n5()
                        if (l == null) H.throw_expression(H.R(l))
                        l = !H.iF(m, l, 0) && J.m1(b[s + $.i()], " ")
                    } else l = false
                    if (l) n = m
                    else {
                        o.push(H.b([m, null, j], r))
                        n = e
                    }
                }
            }
            if (o.length !== 0) c.push(o)
            return c
        },
        inner_main(a) {
            var async_goto = 0,
                async_completer = P._makeAsyncAwaitCompleter(t.eF),
                result, p, o, n, m, runner, k, j, i, h
            var $async$c2 = P._wrapJsFunctionForAsync(function (b, c) {
                if (b === 1) return P.async_rethrow(c, async_completer)
                while (true) switch (async_goto) {
                    case 0:
                        k = t.eV
                        j = H.b([], k)
                        i = t.L
                        h = H.b([], i)
                        k = H.b([], k)
                        i = H.b([], i)
                        p = H.b([], t.gr)
                        o = 0
                        n = $.i()
                        m = -n
                        // run here?
                        runner = new T.fo(j, h, k, i, new H.aT(t.d5), a, p, o, m, m, new Float64Array(n))
                        async_goto = 3
                        return P._asyncAwait(runner.bD(), $async$c2)
                    case 3:
                        result = runner
                        async_goto = 1
                    // break
                    case 1:
                        return P.async_return(result, async_completer)
                }
            })
            return P._asyncStartSync($async$c2, async_completer)
        },
        rT(a, b) {
            var s = a.e,
                r = 0
            return T.nX(s[r], b.e[r])
        },
        RunUpdate(message, caster, c, d, e, f, delay0, delay1) {
            var s = new T.aX(f, 0, 0, message, caster, c, e, d)
            // var s = new T.aX(f, delay0, delay1, message, caster, c, e, d)
            // s.aK(message, caster, c, d, e, f, delay0, delay1)
            s.aK(message, caster, c, d, e, f, 0, 0)
            return s
        },
        aO(a, b, c) {
            var s = null,
                r = new T.h2(0, 1000, 500, a, b, c, s, s)
            r.aK(a, b, c, s, s, 0, 1000, 500)
            return r
        },
        mw() {
            var s, r, q, p
            if ($.lj == null) {
                $.lj = P.c5(t.B)
                s = -$.i()
                for (r = 0; q = $.ox, p = q.length, r < p; ++r) {
                    s += C.String.a8(q, r) - $.b2()
                    $.lj.j(0, C.JsInt.V(s * $.pF(), $.pn()) + $.p9() + p)
                }
            }
            return $.lj
        },
        lC(a) {
            var s, r, q, p, o, n, m, l, k, j, i, h, g, f, e = {},
                d = 0,
                c = H.b([d, d, d, d, d, d], t.i),
                b = 0
            e.a = -$.t()
            e.b = -$.i()
            e.c = b
            s = new T.lD(e, c)
            for (d = a.length, r = b; r < d; ++r) {
                q = C.String.a8(a, r)
                if (q < $.d_()) {
                    if (q === $.at()) {
                        ++b
                        continue
                    }
                    if (q !== $.mW()) p = q >= $.aI() && q <= $.pO()
                    else p = true
                    if (p) s.$1(0)
                    else if (q >= $.q6() && q <= $.p5()) s.$1($.i())
                    else if (q >= $.pT() && q <= $.q3()) s.$1($.t())
                    else s.$1($.B())
                } else if (T.mw().w(0, q)) s.$1($.C())
                else {
                    p = $.X()
                    o = c[p]
                    if (o > 0) c[p] = o + 1
                    s.$1(p)
                }
            }
            d = $.t()
            if (b > d) {
                p = 0
                c[p] = c[p] + b
            }
            n = e.a
            m = 0
            if (n < m) {
                e.a = m
                n = m
            }
            p = e.c
            o = $.av()
            if (p > o) {
                l = $.C()
                o = p - o
                c[l] = c[l] + o
                l = $.B()
                c[l] = c[l] + o
                n += o * d
            }
            if (n > m) {
                d = $.B()
                c[d] = c[d] + 1
                for (k = $.X(); k >= m; --k) {
                    d = c[k]
                    if (d > m) {
                        c[k] = d + e.a
                        break
                    }
                }
                d = $.B()
                c[d] = c[d] - 1
                for (r = m; r < $.a4(); ++r) {
                    d = c[r]
                    if (d > m)
                        if (d >= n) {
                            c[r] = d - n
                            break
                        } else {
                            n -= d
                            c[r] = m
                        }
                }
            }
            d = $.C()
            p = c[d]
            o = $.i()
            if (p == o) {
                p = $.X()
                c[p] = c[p] + o
                c[d] = m
            }
            d = $.pa()
            p = c[m]
            H.ar(d)
            H.ar(p)
            p = Math.pow(d, p)
            d = $.pB()
            o = c[$.i()]
            H.ar(d)
            H.ar(o)
            o = Math.pow(d, o)
            d = $.pS()
            l = c[$.t()]
            H.ar(d)
            H.ar(l)
            l = Math.pow(d, l)
            d = $.ps()
            j = c[$.B()]
            H.ar(d)
            H.ar(j)
            j = Math.pow(d, j)
            d = $.pm()
            i = c[$.C()]
            H.ar(d)
            H.ar(i)
            i = Math.pow(d, i)
            d = $.W()
            h = c[$.X()]
            H.ar(d)
            H.ar(h)
            g = Math.log(p * o * l * j * i * Math.pow(d, h))
            if (g > $.aI()) {
                f = $.n1()
                if (g > f) g = f
                g = g * $.b0() + $.eW()
            } else if (g < $.eW()) g = g * $.b0() + $.cY()
            g -= $.at()
            if (g > 0) return g / ($.rp() - T.mw().a)
            else {
                d = $.rq()
                if (g < -d) return (g + d) / ($.pD() + d - T.mw().a)
            }
            return $.ao()
        },
        nX(a, b) {
            var s = a.Q - b.Q
            if (s !== 0) return s
            return J.lV(a.e, b.e)
        },
        nT(a0, a1, a2, a3) {
            var s, r, q, p, o, n, m, l, k, j, i, h, Plr, f = 0,
                e = $.T(),
                d = H.b([], t.q),
                c = H.b([], t.H),
                b = P.a0(t.X, t.W),
                a = new Sgls.c(t.n)
            a.c = a
            a.b = a
            s = new Sgls.c(t.p)
            s.c = s
            s.b = s
            r = new Sgls.c(t.g)
            r.c = r
            r.b = r
            q = new Sgls.c(t.G)
            q.c = q
            q.b = q
            p = new Sgls.c(t._)
            p.c = p
            p.b = p
            o = new Sgls.c(t.e)
            o.c = o
            o.b = o
            n = new Sgls.c(t.k)
            n.c = n
            n.b = n
            m = new Sgls.c(t.l)
            m.c = m
            m.b = m
            l = new Sgls.c(t.m)
            l.c = l
            l.b = l
            k = t.i
            j = H.b([], k)
            i = H.b([], k)
            h = H.b([], k)
            k = H.b([], k)
            Plr = 0
            Plr = new T.Plr(a0, a1, a2, a3, f, e, d, c, b, a, s, r, q, p, o, n, m, l, j, i, h, k, Plr, Plr, Plr, $.W(), Plr)
            Plr.a1(a0, a1, a2, a3)
            return Plr
        },
        t6(a, b) {
            return J.lV(b.b, a.b)
        },
        tx(a, b, c, d, e) { },
        tz(a, b, c, d, e) { },
        SklAttack(a) {
            var s = new T.h8(0)
            s.r = a
            return s
        },
        hE(a) {
            var s = new T.hD(0)
            s.r = a
            return s
        },
        NoWeapon(a, b) {
            var s = new T.jN(a, b, P.aL($.av(), 0, false, t.B))
            s.a = a
            return s
        },
        tN(a, b) {
            var s = new T.Weapon(a, b, P.aL($.av(), 0, false, t.B))
            s.a = a
            return s
        },
        SklAbsorb: function SklAbsorb(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklAccumulate: function SklAccumulate(a, b) {
            var _ = this
            _.fr = null
            _.fx = a
            _.e = false
            _.f = b
            _.c = _.b = _.a = _.r = null
        },
        SklAssassinate: function SklAssassinate(a) {
            var _ = this
            _.fy = _.fx = _.fr = null
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        dd: function dd(a, b) {
            var _ = this
            _.fr = a
            _.e = false
            _.f = b
            _.c = _.b = _.a = _.r = null
        },
        SklBerserk: function SklBerserk(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklCharge: function SklCharge(a, b) {
            var _ = this
            _.fx = _.fr = null
            _.fy = a
            _.e = false
            _.f = b
            _.c = _.b = _.a = _.r = null
        },
        dj: function dj(a, b, c) {
            var _ = this
            _.r = a
            _.x = b
            _.y = null
            _.z = c
            _.c = _.b = _.a = null
        },
        SklCharm: function SklCharm(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        dI: function dI(a) {
            this.b = a
        },
        dR: function dR(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.cm = _.a6 = null
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        SklClone: function SklClone(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        k9: function k9() { },
        SklCritical: function SklCritical(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        dn: function dn(a, b, c, d) {
            var _ = this
            _.r = a
            _.x = b
            _.y = null
            _.z = c
            _.Q = d
            _.c = _.b = _.a = null
        },
        SklCurse: function SklCurse(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklDisperse: function SklDisperse(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklExchange: function SklExchange(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        c3: function c3(a) {
            this.b = a
        },
        SklFire: function SklFire(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        sklHalf: function sklHalf(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        dw: function dw(a, b, c) {
            var _ = this
            _.x = a
            _.y = null
            _.z = b
            _.Q = c
            _.c = _.b = _.a = null
        },
        SklHaste: function SklHaste(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklHeal: function SklHeal(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        ka: function ka(a) {
            this.a = a
        },
        dx: function dx(a, b) {
            var _ = this
            _.r = a
            _.x = null
            _.y = b
            _.c = _.b = _.a = null
        },
        SklIce: function SklIce(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklIron: function SklIron(a, b, c) {
            var _ = this
            _.fy = _.fx = _.fr = null
            _.go = a
            _.id = b
            _.e = false
            _.f = c
            _.c = _.b = _.a = _.r = null
        },
        dS: function dS(a, b, c) {
            var _ = this
            _.r = a
            _.x = b
            _.y = null
            _.z = c
            _.c = _.b = _.a = null
        },
        SklPoison: function SklPoison(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklQuake: function SklQuake(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklRapid: function SklRapid(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklRevive: function SklRevive(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        hu: function hu(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        PlrShadow: function fS(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a6 = _.aj = null
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        SklShadow: function SklShadow(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        eh: function eh(a, b) {
            var _ = this
            _.x = a
            _.y = null
            _.z = b
            _.c = _.b = _.a = null
        },
        SklSlow: function SklSlow(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        hj: function hj(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        PlrSummon: function fT(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.bi = _.aj = null
            _.aR = false
            _.a6 = null
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        SklSummon: function SklSummon(a) {
            var _ = this
            _.fr = null
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklThunder: function SklThunder(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        f5: function f5(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        h6: function h6(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        e2: function e2(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        fP: function fP(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7, a8) {
            var _ = this
            _.a6 = a
            _.a = b
            _.b = c
            _.c = d
            _.d = e
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = f
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = g
            _.k1 = h
            _.k3 = _.k2 = null
            _.k4 = i
            _.r1 = null
            _.r2 = j
            _.rx = k
            _.ry = l
            _.x1 = m
            _.x2 = n
            _.y1 = o
            _.y2 = p
            _.G = q
            _.L = r
            _.S = s
            _.A = false
            _.q = a0
            _.X = null
            _.E = a1
            _.t = a2
            _.a2 = a3
            _.M = a4
            _.N = a5
            _.Y = a6
            _.H = a7
            _.l = a8
            _.a_ = _.Z = false
            _.I = null
        },
        PlrBossTest: function fU(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        PlrBossTest2: function fV(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        fQ: function fQ(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        cz: function cz() { },
        f6: function f6(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        hb: function hb(a, b, c) {
            var _ = this
            _.fr = a
            _.fx = b
            _.e = false
            _.f = c
            _.c = _.b = _.a = _.r = null
        },
        PlrBossCovid: function f7(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        dk: function dk(a) {
            this.b = false
            this.c = a
        },
        dl: function dl(a, b, c, d, e) {
            var _ = this
            _.fr = a
            _.fx = b
            _.fy = c
            _.go = d
            _.k2 = _.k1 = _.id = null
            _.e = false
            _.f = e
            _.c = _.b = _.a = _.r = null
        },
        he: function he(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        hd: function hd(a, b) {
            var _ = this
            _.fr = a
            _.e = false
            _.f = b
            _.c = _.b = _.a = _.r = null
        },
        f8: function f8(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        hn: function hn(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        hm: function hm(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        de: function de(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        dB: function dB(a, b, c) {
            var _ = this
            _.fr = a
            _.fx = b
            _.id = _.go = _.fy = null
            _.e = false
            _.f = c
            _.c = _.b = _.a = _.r = null
        },
        hq: function hq(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        hp: function hp(a, b, c) {
            var _ = this
            _.fr = a
            _.fx = b
            _.e = false
            _.f = c
            _.c = _.b = _.a = _.r = null
        },
        df: function df(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7, a8) {
            var _ = this
            _.aC = a
            _.aR = _.bi = _.aj = null
            _.a = b
            _.b = c
            _.c = d
            _.d = e
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = f
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = g
            _.k1 = h
            _.k3 = _.k2 = null
            _.k4 = i
            _.r1 = null
            _.r2 = j
            _.rx = k
            _.ry = l
            _.x1 = m
            _.x2 = n
            _.y1 = o
            _.y2 = p
            _.G = q
            _.L = r
            _.S = s
            _.A = false
            _.q = a0
            _.X = null
            _.E = a1
            _.t = a2
            _.a2 = a3
            _.M = a4
            _.N = a5
            _.Y = a6
            _.H = a7
            _.l = a8
            _.a_ = _.Z = false
            _.I = null
        },
        hr: function hr(a, b) {
            var _ = this
            _.fr = a
            _.e = false
            _.f = b
            _.c = _.b = _.a = _.r = null
        },
        ea: function ea(a, b) {
            var _ = this
            _.Q = a
            _.e = false
            _.f = b
            _.c = _.b = _.a = _.r = null
        },
        f9: function f9(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        fa: function fa(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        hA: function hA(a, b, c, d, e) {
            var _ = this
            _.fr = a
            _.fx = b
            _.fy = c
            _.go = d
            _.id = null
            _.e = false
            _.f = e
            _.c = _.b = _.a = _.r = null
        },
        cy: function cy() { },
        fR: function fR(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        PlrBossSlime: function bZ(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7, a8) {
            var _ = this
            _.aC = a
            _.a = b
            _.b = c
            _.c = d
            _.d = e
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = f
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = g
            _.k1 = h
            _.k3 = _.k2 = null
            _.k4 = i
            _.r1 = null
            _.r2 = j
            _.rx = k
            _.ry = l
            _.x1 = m
            _.x2 = n
            _.y1 = o
            _.y2 = p
            _.G = q
            _.L = r
            _.S = s
            _.A = false
            _.q = a0
            _.X = null
            _.E = a1
            _.t = a2
            _.a2 = a3
            _.M = a4
            _.N = a5
            _.Y = a6
            _.H = a7
            _.l = a8
            _.a_ = _.Z = false
            _.I = null
        },
        fb: function fb(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
            var _ = this
            _.dk = a
            _.aC = b
            _.a = c
            _.b = d
            _.c = e
            _.d = f
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = g
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = h
            _.k1 = i
            _.k3 = _.k2 = null
            _.k4 = j
            _.r1 = null
            _.r2 = k
            _.rx = l
            _.ry = m
            _.x1 = n
            _.x2 = o
            _.y1 = p
            _.y2 = q
            _.G = r
            _.L = s
            _.S = a0
            _.A = false
            _.q = a1
            _.X = null
            _.E = a2
            _.t = a3
            _.a2 = a4
            _.M = a5
            _.N = a6
            _.Y = a7
            _.H = a8
            _.l = a9
            _.a_ = _.Z = false
            _.I = null
        },
        hF: function hF() { },
        ef: function ef(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        fc: function fc(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        fd: function fd(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        eg: function eg(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        fo: function fo(a, b, c, d, e, f, g, h, i, j, k) {
            var _ = this
            _.a = a
            _.b = null
            _.c = b
            _.d = c
            _.e = d
            _.f = null
            _.r = e
            _.x = f
            _.z = g
            _.Q = h
            _.ch = i
            _.cx = false
            _.cy = null
            _.db = j
            _.dx = k
        },
        jk: function jk() { },
        jj: function jj() { },
        jl: function jl(a) {
            this.a = a
        },
        ji: function ji(a) {
            this.a = a
        },
        b7: function b7(a, b, c, d, e) {
            var _ = this
            _.a = a
            _.b = null
            _.c = b
            _.d = c
            _.e = d
            _.f = e
        },
        IPlr: function fr() { },
        NPlr: function bF() {
            this.a = null
        },
        HPlr: function V(a) {
            var _ = this
            _.b = null
            _.c = a
            _.a = _.d = null
        },
        MPlr: function dF() {
            this.a = this.c = this.b = null
        },
        DPlr: function dp() {
            this.a = null
        },
        HDamage: function bB(a) {
            this.a = a
        },
        HRecover: function bm(a) {
            this.a = a
        },
        aX: function aX(a, b, c, d, e, f, g, h) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.e = e
            _.f = f
            _.r = g
            _.x = h
        },
        h2: function h2(a, b, c, d, e, f, g, h) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.e = e
            _.f = f
            _.r = g
            _.x = h
        },
        dX: function dX(a, b, c, d, e, f, g, h) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.e = e
            _.f = f
            _.r = g
            _.x = h
        },
        aq: function aq(a, b) {
            this.a = a
            this.b = b
        },
        lD: function lD(a, b) {
            this.a = a
            this.b = b
        },
        aM: function aM() { },
        Plr: function u(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.weapon = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        jX: function jX() { },
        BoostPassive: function boost_passive() { }, // boostPassive
        jY: function jY() { },
        x: function x() { },
        aZ: function aZ() { },
        cB: function cB() { },
        bH: function bH() { },
        aB: function aB() { },
        ah: function ah() { },
        aV: function aV() { },
        bq: function bq() { },
        aF: function aF() { },
        bd: function bd(a) {
            var _ = this
            _.x = a
            _.c = _.b = _.a = null
        },
        fY: function fY(a) {
            var _ = this
            _.x = a
            _.c = _.b = _.a = null
        },
        dT: function dT(a, b) {
            var _ = this
            _.r = a
            _.x = b
            _.c = _.b = _.a = null
        },
        cA: function cA(a) {
            var _ = this
            _.x = a
            _.c = _.b = _.a = null
        },
        ca: function ca(a) {
            var _ = this
            _.x = a
            _.c = _.b = _.a = null
        },
        b8: function b8(a) {
            var _ = this
            _.x = a
            _.c = _.b = _.a = null
        },
        cp: function cp(a) {
            var _ = this
            _.x = a
            _.c = _.b = _.a = null
        },
        bG: function bG(a, b) {
            this.a = a
            this.b = b
        },
        Skill: function Skill() { },
        ActionSkill: function b5() { },
        h8: function h8(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        hD: function hD(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklCounter: function SklCounter(a) {
            var _ = this
            _.Q = false
            _.cx = _.ch = null
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklDefend: function SklDefend(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklHide: function SklHide(a) {
            var _ = this
            _.ch = _.Q = null
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        fC: function fC() { },
        SklMerge: function SklMerge(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        dV: function dV(a, b) {
            var _ = this
            _.r = a
            _.x = b
            _.c = _.b = _.a = null
        },
        SklProtect: function SklProtect(a) {
            var _ = this
            _.Q = null
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklReflect: function SklReflect(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklReraise: function SklReraise(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        e0: function e0(a, b) {
            var _ = this
            _.r = a
            _.x = b
            _.c = _.b = _.a = null
        },
        SklShield: function SklShield(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SklUpgrade: function SklUpgrade(a) {
            var _ = this
            _.Q = null
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        SkillVoid: function SkillVoid(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        fX: function fX(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, a0, a1, a2, a3, a4, a5, a6, a7) {
            var _ = this
            _.a6 = _.aj = null
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.z = _.y = _.x = _.r = _.f = _.e = null
            _.Q = e
            _.go = _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = _.cx = _.ch = null
            _.id = f
            _.k1 = g
            _.k3 = _.k2 = null
            _.k4 = h
            _.r1 = null
            _.r2 = i
            _.rx = j
            _.ry = k
            _.x1 = l
            _.x2 = m
            _.y1 = n
            _.y2 = o
            _.G = p
            _.L = q
            _.S = r
            _.A = false
            _.q = s
            _.X = null
            _.E = a0
            _.t = a1
            _.a2 = a2
            _.M = a3
            _.N = a4
            _.Y = a5
            _.H = a6
            _.l = a7
            _.a_ = _.Z = false
            _.I = null
        },
        hY: function hY() { },
        SklZombie: function SklZombie(a) {
            var _ = this
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        j2: function j2(a, b, c) {
            var _ = this
            _.a = null
            _.b = a
            _.c = b
            _.f = _.e = _.d = null
            _.r = c
        },
        hg: function hg(a) {
            var _ = this
            _.fx = _.fr = null
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        eo: function eo(a, b, c) {
            var _ = this
            _.a = null
            _.b = a
            _.c = b
            _.f = _.e = _.d = null
            _.r = c
        },
        fl: function fl() { },
        jq: function jq(a, b, c) {
            var _ = this
            _.a = null
            _.b = a
            _.c = b
            _.f = _.e = _.d = null
            _.r = c
        },
        jN: function jN(a, b, c) {
            var _ = this
            _.a = null
            _.b = a
            _.c = b
            _.f = _.e = _.d = null
            _.r = c
        },
        k1: function k1(a, b, c) {
            var _ = this
            _.a = null
            _.b = a
            _.c = b
            _.f = _.e = _.d = null
            _.r = c
        },
        k3: function k3() { },
        h0: function h0(a) {
            var _ = this
            _.r = a
            _.c = _.b = _.a = null
        },
        k2: function k2(a) {
            this.a = a
        },
        h1: function h1() {
            this.c = this.b = this.a = null
        },
        ee: function ee(a, b) {
            var _ = this
            _.fr = a
            _.e = false
            _.f = b
            _.c = _.b = _.a = _.r = null
        },
        hy: function hy(a, b) {
            var _ = this
            _.Q = a
            _.e = false
            _.f = b
            _.c = _.b = _.a = _.r = null
        },
        hz: function hz(a, b) {
            var _ = this
            _.fr = a
            _.e = false
            _.f = b
            _.c = _.b = _.a = _.r = null
        },
        kb: function kb() { },
        ep: function ep(a, b, c) {
            var _ = this
            _.a = null
            _.b = a
            _.c = b
            _.f = _.e = _.d = null
            _.r = c
        },
        Weapon: function Weapon(a, b, c) {
            var _ = this
            _.a = null
            _.b = a
            _.c = b
            _.f = _.e = _.d = null
            _.r = c
        },
        kq: function kq() { },
        kr: function kr() { },
        ks: function ks() { },
        kt: function kt() { },
        ku: function ku() { },
        ko: function ko() { },
        kp: function kp() { },
        hc: function hc(a) {
            var _ = this
            _.Q = false
            _.cx = _.ch = null
            _.e = false
            _.f = a
            _.c = _.b = _.a = _.r = null
        },
        kv: function kv(a, b, c) {
            var _ = this
            _.a = null
            _.b = a
            _.c = b
            _.f = _.e = _.d = null
            _.r = c
        },
        ij: function ij() { },
        ik: function ik() { }
    },
    V = {
        // 评分
        // 普评/强评
        ProfileMain: function iV(a, b, c, d, e, f, g) {
            var _ = this
            _.a = a
            _.b = b
            _.c = false
            _.d = 1000
            _.e = 33554431
            _.f = c
            _.r = d
            _.x = null
            _.y = e
            _.z = f
            _.ch = _.Q = 0
            _.cx = null
            _.cy = g
        },
        j_: function j_(a, b) {
            this.a = a
            this.b = b
        },
        j0: function j0() { },
        j1: function j1(a) {
            this.a = a
        }
    },
    W = {
        j4() {
            var s = document.createElement("canvas")
            return s
        },
        rP(a, b, c) {
            var s, doc_body = document.body
            doc_body.toString
            s = C.BodyElement.aA(doc_body, a, b, c)
            s.toString
            doc_body = new H.cf(new W.az(s), new W.jf(), t.ac.i("cf<z.E>"))
            return t.R.a(doc_body.gba(doc_body))
        },
        ds(a) {
            var s, r, q = "element tag unavailable"
            try {
                s = J.bv(a)
                if (typeof s.gdD(a) == "string") q = s.gdD(a)
            } catch (r) {
                H.unwrap_Exception(r)
            }
            return q
        },
        nK() {
            var s = document.createElement("img")
            return s
        },
        es(a, b, c, d) {
            // 设置 event listener
            var s = W.uJ(new W.kF(c), t.aD)
            if (s != null) {
                J.rs(a, b, s, false)
            }
            return new W.ia(a, b, s, false)
        },
        oc(a) {
            var s = document.createElement("a"),
                r = new W.l_(s, window.location)
            r = new W.cP(r)
            r.e6(a)
            return r
        },
        tT(a, b, c, d) {
            return true
        },
        tU(a, b, c, d) {
            var s, r = d.a,
                q = r.a
            q.href = c
            s = q.hostname
            r = r.b
            if (!(s == r.hostname && q.port == r.port && q.protocol == r.protocol))
                if (s === "")
                    if (q.port === "") {
                        r = q.protocol
                        r = r === ":" || r === ""
                    } else r = false
                else r = false
            else r = true
            return r
        },
        oh() {
            var s = t.N,
                r = P.nQ(C.r, s),
                q = H.b(["TEMPLATE"], t.s)
            s = new W.it(r, P.c5(s), P.c5(s), P.c5(s), null)
            s.e7(null, new H.y(C.r, new W.l7(), t.fj), q, null)
            return s
        },
        ll(a) {
            return W.oa(a)
        },
        oa(a) {
            if (a === window) return a
            else return new W.kE(a)
        },
        uJ(a, b) {
            var s = $.P
            if (s === C.f) return a
            return s.eI(a, b)
        },
        HtmlElement: function HtmlElement() { },
        AnchorElement: function AnchorElement() { },
        AreaElement: function AreaElement() { },
        BaseElement: function BaseElement() { },
        Blob: function Blob() { },
        BodyElement: function BodyElement() { },
        CanvasElement: function CanvasElement() { },
        CanvasRenderingContext2D: function CanvasRenderingContext2D() { },
        b6: function b6() { },
        co: function co() { },
        j8: function j8() { },
        dm: function dm() { },
        c0: function c0() { },
        ja: function ja() { },
        jb: function jb() { },
        Element: function Element() { },
        jf: function jf() { },
        o: function o() { },
        fn: function fn() { },
        cq: function cq() { },
        fp: function fp() { },
        c4: function c4() { },
        jL: function jL() { },
        c8: function c8() { },
        dH: function dH() { },
        bp: function bp() { },
        az: function az(a) {
            this.a = a
        },
        v: function v() { },
        dM: function dM() { },
        dQ: function dQ() { },
        h4: function h4() { },
        ek: function ek() { },
        hN: function hN() { },
        kd: function kd(a) {
            this.a = a
        },
        bb: function bb() { },
        ce: function ce() { },
        en: function en() { },
        hQ: function hQ() { },
        hR: function hR() { },
        cI: function cI() { },
        aY: function aY() { },
        eq: function eq() { },
        cL: function cL() { },
        ex: function ex() { },
        eH: function eH() { },
        i2: function i2() { },
        i8: function i8(a) {
            this.a = a
        },
        m5: function m5(a, b) {
            this.a = a
            this.$ti = b
        },
        ia: function ia(a, b, c, d) {
            var _ = this
            _.b = a
            _.c = b
            _.d = c
            _.e = d
        },
        kF: function kF(a) {
            this.a = a
        },
        cP: function cP(a) {
            this.a = a
        },
        cr: function cr() { },
        dN: function dN(a) {
            this.a = a
        },
        jP: function jP(a) {
            this.a = a
        },
        jO: function jO(a, b, c) {
            this.a = a
            this.b = b
            this.c = c
        },
        eD: function eD() { },
        l0: function l0() { },
        l1: function l1() { },
        it: function it(a, b, c, d, e) {
            var _ = this
            _.e = a
            _.a = b
            _.b = c
            _.c = d
            _.d = e
        },
        l7: function l7() { },
        is: function is() { },
        dv: function dv(a, b) {
            var _ = this
            _.a = a
            _.b = b
            _.c = -1
            _.d = null
        },
        kE: function kE(a) {
            this.a = a
        },
        l_: function l_(a, b) {
            this.a = a
            this.b = b
        },
        ix: function ix(a) {
            this.a = a
            this.b = 0
        },
        le: function le(a) {
            this.a = a
        },
        i6: function i6() { },
        ig: function ig() { },
        ih: function ih() { },
        il: function il() { },
        iy: function iy() { },
        iz: function iz() { },
        iA: function iA() { },
        iB: function iB() { }
    },
    X = {
        dc(a) {
            // 似乎是什么算号方法?
            var s, r, q, p, o, n, m = a.length,
                l = P.aL(C.d.R(m * 8 / 6.5), 0, true, t.B)
            for (s = 0, r = 0, q = 0, p = 0, o = 0; o < m; ++o) {
                s = (s | C.JsInt.bX(a[o] & 255 ^ 0, r)) >>> 0
                r += 8
                if (r > 13) {
                    q = s & 8191
                    if (q > 456) {
                        s = s >>> 13
                        r -= 13
                    } else {
                        q = s & 16383
                        s = s >>> 14
                        r -= 14
                    }
                    n = p + 1
                    // l[p] = J.J($.iM(), C.JsInt.V(q, 93))
                    l[p] = $.iM()[C.JsInt.V(q, 93)]
                    p = n + 1
                    // l[n] = J.J($.iM(), q / 93 | 0)
                    l[n] = $.iM()[q / 93 | 0]
                }
            }
            if (r > 0) {
                n = p + 1
                // l[p] = J.J($.iM(), C.JsInt.V(s, 93))
                l[p] = $.iM()[C.JsInt.V(s, 93)]
                if (r > 7 || s > 92) {
                    p = n + 1
                    // l[n] = J.J($.iM(), s / 93 | 0)
                    l[n] = $.iM()[s / 93 | 0]
                } else {
                    p = n
                }
            }
            C.Array.sp(l, p)
            return P.mh(l, 0, null)
        },
        f4(a, b) {
            var s, r, q, p, o, n, m, l, k, j = a.length,
                i = P.aL(C.d.R(j * 7 / 8), 0, true, t.B)
            for (s = J.aQ(a), r = 0, q = 0, p = -1, o = 0, n = 0; n < j; ++n) {
                m = s.a8(a, n)
                if (m > 126) continue
                // l = J.J($.oS(), m)
                l = $.oS()[m]
                if (l === 93) {
                    continue
                }
                if (p === -1) {
                    p = l
                } else {
                    p += l * 93
                    r |= C.JsInt.bX(p, q)
                    q += (p & 8191) > 456 ? 13 : 14
                    do {
                        k = o + 1
                        i[o] = r & 255 ^ b
                        r = r >>> 8
                        q -= 8
                        if (q > 7) {
                            o = k
                            continue
                        } else break
                    } while (true)
                    o = k
                    p = -1
                }
            }
            if (p !== -1) {
                k = o + 1
                i[o] = ((r | C.JsInt.bX(p, q)) ^ b) >>> 0
                o = k
            }
            C.Array.sp(i, o)
            return i
        },
        k(a, b) {
            var s, r, q = new Uint8Array(H.on(X.f4(a, b))).buffer
            H.mq(q, 0, null)
            s = q.byteLength
            r = C.JsInt.ag(s - 0, 4)
            let result = new Uint32Array(q, 0, r)[1]
            // return new Uint32Array(q, 0, r)[1]
            // if (run_env.from_code) {
            //     console.log("X.k", a, b, result)
            // }
            logger.debug("X.k", a, b, result)
            return result
        },
        D(a, b) {
            var s, r, q = new Uint8Array(H.on(X.f4(a, b))).buffer
            H.mq(q, 0, null)
            s = q.byteLength
            r = C.JsInt.ag(s - 0, 4)
            let result = new Float32Array(q, 0, r)[1];
            // return new Float32Array(q, 0, r)[1]
            // if (run_env.from_code) {
            //     console.log("X.D", a, b, result)
            // }
            logger.debug("X.D", a, b, result)
            return result
        },
        je: function je() { },
        j9: function j9() { },
        ProfileFind: function iW(a, b) {
            var _ = this
            _.a = a
            _.b = -1
            _.c = 33554431
            _.e = 0
            _.f = null
            _.r = b
        },
        iX: function iX() { },
        iY: function iY(a) {
            this.a = a
        },
        iZ: function iZ(a) {
            this.a = a
        }
    },
    Y = {
        RC4: function dW() {
            this.b = this.a = 0
            this.c = null
        }
    },
    HtmlRenderer = {
        add_span(a) {
            var s = document.createElement("span")
            s.classList.add(a)
            return s
        },
        add_div(a) {
            var s = document.createElement("div")
            s.classList.add(a)
            return s
        },
        add_p(a) {
            var s = document.createElement("p")
            s.classList.add(a)
            return s
        },
        static_init() {
            var async_goto = 0,
                r = P._makeAsyncAwaitCompleter(t.z),
                q, p
            var $async$jv = P._wrapJsFunctionForAsync(function (a, b) {
                if (a === 1) return P.async_rethrow(b, r)
                while (true) switch (async_goto) {
                    case 0:
                        if (run_env.from_code) {
                            // 直接忽略这里的 wait
                            async_goto = 2
                        } else {
                            Sgls.tw()
                            q = W.nK()
                            $.md = q
                            W.es(q, "load", Sgls.vg(), false)
                            $.md.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACAAgMAAAC+UIlYAAAADFBMVEX/AAD/AP8A/wD///8SU+EWAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3wwaCg0BGtaVrQAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAADHUlEQVRYw+2WPY6jMBTHLejhMNOu4BRkpTTp5xIgzQGmilKmSjFUkbZFCpp6tN3mHGikpAK8/r/nZwhxMlllViOtFsWxsX/2+7SNKj941E7r/lr5Q6BNuW5iqqtv3xLlBtKW67jpd3XY75SyAF4wAwMAwpqLAVgEADuDANOu4iahCQ7AIAaUSrBalbYEDCI+BESPiyJk0KukmCnlzMybHHVXLD4M9w35oIJC6R4FbVm6UNw2QB0UoQcIawGaoIg9QNwI0AZF6gHSVgAdFNoDmH4BXp88gOl7FeD92QOYvvcTYDBvAAE5ET4AYpySPgCKOjO9gDHVOcoLGGc5V3sB424XLC9gAvYZ+WAT1Joa0KahxEWWx/0AkKntAJhBQANApjYEcDZhx+kB2JKpdTQA2GEjoGLzEidCN0kVW4BmKCilegGedRttU0RTgBpKhQ544iC+DkADpWIHFJwGwQCY5SFGACwPMU5JUtAoKkDFZicjoI5gqjOTze5HAOeFA2r0hWOAM+tiLCQ3z2LxGedDnVSjnNwqFU3OKDho6KDTltu049SuhYtT3os4Bu0BKjuOrTCFdjPaOERHVinMxip0HsixPPKLYvmKTxS5M0aeVWxBnWzjJqrCOhks4B3nAAwCOgNEBJaXg4vFWBGiJBSUg4sVFSWtmc5UAGyqNdM6CsvKwWWdZR01cfXI3dbVk2BNA/Yp+WCX5TSPxncFiZAXB5ivALIGXwM+ALcuANQ/Ht5+ngHbsI4AoK7eHpKrK5zcmxd18FkhLicdrgGkw00ioOhVJcfA2Eynw6UVnA5j4CYzT4J1fz5cGnDfD38RkM+DLwTc7f/VwLXb/37g/nz4D/yTwEuWPWbmKTN6ynI5K7P5JkNZZtlMLbWe5Vp3m1x35jdfLg6zfL/q8l/fu4XWB7XW+ghgpQHoPTrzwwJtKoo6TGPNHUcZcIA0FlwfLgLTIitfBES3rwROlLQvh8VkkDyJP+PFPZy0niyPmly90XoON6/sLDuhWx8WRwrWS949IlAIGIK1ybs5grXer44U7pKjXdKfCTe9I9zzzew3hQ1VpfX/zmMAAAAASUVORK5CYII="
                            async_goto = 2
                            // 等待这个 callback 被调用
                            return P._asyncAwait($.nt().a, $async$jv)
                        }
                    case 2:
                        if (run_env.from_code) {
                            logger.debug("loading gAd data")
                            // 暂时有问题, 还得调试
                            LangData.load_lang(t.cF.a(C.C.bt(0, assets_data.lang)))
                            // LangData.v1(assets_data.lang)
                            // LangData.load_lang(assets_data.lang)
                        } else {
                            p = window.sessionStorage.getItem(LangData.eQ("ll"))
                            if (typeof p == "string") {
                                LangData.load_lang(t.cF.a(C.C.bt(0, p)))
                            }
                        }
                        return P.async_return(null, r)
                }
            })
            return P._asyncStartSync($async$jv, r)
        },
        outer_main(a) {
            var s = document

            let plist = s.querySelector(".plist")
            let pbody = s.querySelector(".pbody")

            s = new HtmlRenderer.inner_render(plist, pbody, a, $.ro().ax(256))
            s.e0(a)
            logger.debug("finish html.outer_main")
            return s
        },
        aA(a, b, c, d, e, f) {
            var s = a.measureText(b)
            if (f && s.width < e) c += C.d.ag(e - s.width, 2)
            a.fillText(b, c, d + 15, e)
            return s.width
        },
        ju(a, b, c, d) {
            $.bU().src = $.mg.h(0, b.fy)
            a.drawImage($.bU(), c + 4, d + 6)
            HtmlRenderer.aA(a, b.dx, c + 24, d + 5, 90, false)
        },
        rV(a, b) {
            logger.debug("reaching html.rV")
            var s, r, q, p, o, n, m, l, k, j, i, h = "#000000",
                g = "#EEEEEE",
                f = W.j4(),
                e = 1
            if (a.length + b.length <= 128) e = 2
            f.width = 320 * e
            f.height = ((a.length + b.length) * 26 + 88) * e + 24
            s = f.getContext("2d")
            s.imageSmoothingEnabled = false
            s.fillStyle = "white"
            J.bj(s, 0, 0, f.width, f.height)
            if (!J.Y(e, 1)) J.rC(s, e, 0, 0, e, 0, 0)
            q = document.body
            q.toString
            s.font = window.getComputedStyle(q, "").font
            s.fillStyle = h
            HtmlRenderer.aA(s, "\u21dc\u3000" + LangData.get_lang("CeaN") + "\u3000\u21dd", 0, 4, 320, true)
            r = 26
            s.fillStyle = "#FAFAFA"
            J.bj(s, 0, r, 320, 32)
            s.fillStyle = g
            J.bj(s, 0, r, 320, 2)
            s.fillStyle = h
            p = HtmlRenderer.aA(s, LangData.get_lang("ePya"), 0, r + 8, 114, true)
            HtmlRenderer.aA(s, LangData.get_lang("AoUA"), 114, r + 8, 46, true)
            HtmlRenderer.aA(s, LangData.get_lang("aXIa"), 160, r + 8, 46, true)
            HtmlRenderer.aA(s, LangData.get_lang("MdQa"), 206, r + 8, 114, true)
            $.bU().src = "data:image/gif;base64,R0lGODlhFAAUALMAAAAAAP///98AJDsBRb3L09fi6NHf5ur2/JbFU63abcPuhcLthc/1mf///wAAAAAAACH5BAEAAA0ALAAAAAAUABQAAASCsMk5x6A4y6Gu/pyCXMJUaqGiJELbtCc1MOqiwnhl7aq675WAUGgIDYaBQ7FxTA4OyuIRengalr+fL2thWnrgcKLLLFS53ALh0nxWoe64mi1s1++BwZyJt+fre3p/g356axuEfQEFA4cbjIp5c44beowFl2sEax4yjY2aoZ0ZaEAUEQA7"
            q = $.bU()
            o = C.d.ag(114 - p, 2) - 24
            J.iO(s, q, o, r + 6)
            q = $.bU()
            n = C.d.ag(114 + p, 2) + 4
            J.iO(s, q, n, r + 6)
            r += 32
            for (q = a.length, m = 0; m < a.length; a.length === q || (0, H.F)(a), ++m) {
                l = a[m]
                s.fillStyle = g
                J.bj(s, 0, r, 320, 2)
                s.fillStyle = "#ddddd0"
                J.bj(s, 22, r + 4, C.d.aI(l.z.offsetWidth), 2)
                s.fillStyle = "#4c4"
                J.bj(s, 22, r + 4, C.d.R(l.go / 4), 2)
                s.fillStyle = h
                HtmlRenderer.ju(s, l, 0, r)
                HtmlRenderer.aA(s, C.JsInt.k(l.c), 114, r + 5, 46, true)
                HtmlRenderer.aA(s, C.JsInt.k(l.d), 160, r + 5, 46, true)
                k = l.e
                if (k != null) HtmlRenderer.ju(s, $.ay.h(0, k), 206, r)
                r += 26
            }
            s.fillStyle = "#FAFAFA"
            J.bj(s, 0, r, 320, 32)
            s.fillStyle = g
            J.bj(s, 0, r, 320, 2)
            s.fillStyle = h
            HtmlRenderer.aA(s, LangData.get_lang("eFKN"), 0, r + 8, 114, true)
            HtmlRenderer.aA(s, LangData.get_lang("AoUA"), 114, r + 8, 46, true)
            HtmlRenderer.aA(s, LangData.get_lang("aXIa"), 160, r + 8, 46, true)
            HtmlRenderer.aA(s, LangData.get_lang("MdQa"), 206, r + 8, 114, true)
            $.bU().src = "data:image/gif;base64,R0lGODlhFAAUAMQAAAAAAP///98AJDsBRd3y/vv+/4m4RpbFU6LPYqLOYqLPY6PPY6HNYq3abazYbbfgfcPuhc/1mdL1n9/9td78td36tHqpNYi3Q4i2Q4azQ5/JYZzEYMPqiv39/f///wAAACH5BAEAAB4ALAAAAAAUABQAAAWOoCeO4zCQaCoO0Km+LHScwlirMQQ1Qu/1N9IgoisCj6hhZFLcHYOryLKp4/mE0gmT6nStJBXKlru7eAcSMrXRcLHS6iLbcjLZ7cX73RPrEAhqfgR0fBASHQWAZIiDdQgNHZGBBR1mK5CSi5FnGpSKa5EEXnyeXGyeKaEOegMIoSkEfgMJCwkKDAYDsQQjIQA7"
            J.iO(s, $.bU(), o, r + 6)
            J.iO(s, $.bU(), n, r + 6)
            r += 32
            for (q = b.length, m = 0; m < b.length; b.length === q || (0, H.F)(b), ++m) {
                j = b[m]
                s.fillStyle = g
                J.bj(s, 0, r, 320, 2)
                s.fillStyle = h
                HtmlRenderer.ju(s, j, 0, r)
                HtmlRenderer.aA(s, C.JsInt.k(j.c), 114, r + 5, 46, true)
                HtmlRenderer.aA(s, C.JsInt.k(j.d), 160, r + 5, 46, true)
                o = j.e
                if (o != null) HtmlRenderer.ju(s, $.ay.h(0, o), 206, r)
                r += 26
            }
            s.fillStyle = "#F8F8F8"
            J.bj(s, 0, r, 320, 2)
            try {
                J.rx(s)
                r *= e
                s.fillStyle = "#888888"
                HtmlRenderer.aA(s, $.qp(), 0, r + 2, 140, false)
            } catch (i) {
                H.unwrap_Exception(i)
            }
            return f
        },
        rU(a, b) {
            var s = a.c,
                r = b.c
            if (s === r) return a.cx - b.cx
            return r - s
        },
        t9(a) {
            var s = J.m_(a, "+")
            if (s > -1) return C.String.af(a, 0, s) + '<span class="small">' + C.String.ay(a, s) + "</span>"
            return a
        },
        t7(a, b, c) {
            var s = HtmlRenderer.add_div("plr_list"),
                r = HtmlRenderer.add_div("sgl"),
                q = HtmlRenderer.add_div("name"),
                p = HtmlRenderer.add_div("maxhp"),
                o = HtmlRenderer.add_div("oldhp"),
                n = HtmlRenderer.add_div("hp"),
                m = $.jU + 1
            $.jU = m
            m = new HtmlRenderer.ax(a, s, r, q, p, o, n, m)
            m.cP(a, b, c, {})
            return m
        },
        t8(a, b, c) {
            var s = HtmlRenderer.add_div("plr_list"),
                r = HtmlRenderer.add_div("sgl"),
                q = HtmlRenderer.add_div("name"),
                p = HtmlRenderer.add_div("maxhp"),
                o = HtmlRenderer.add_div("oldhp"),
                n = HtmlRenderer.add_div("hp"),
                m = $.jU + 1
            $.jU = m
            m = new HtmlRenderer.fW(a, s, r, q, p, o, n, m)
            m.cP(a, b, false, {})
            return m
        },
        uI(a) {
            var s, span_element, q, p, o, max_hp_element, m, l, k, j, i, h, g, f = a.a
            if (f > 0 && a.e != null) $.ay.h(0, a.e.gb2()).dc(f)
            s = H.b([], t.j)
            span_element = HtmlRenderer.add_span("u")
            C.R.by(span_element, H.oO(a.d, $.rm(), new HtmlRenderer.lq(new HtmlRenderer.lp(s, a), a), null), $.bV())
            for (f = s.length, q = t.A, p = 0; p < s.length; s.length === f || (0, H.F)(s), ++p) {
                o = s[p]
                if (o instanceof T.HPlr) {
                    max_hp_element = q.a(span_element.querySelector("." + H.as_string(o.b) + " > .maxhp"))
                    m = o.c
                    if (m >= o.d) {
                        l = document
                        k = l.createElement("div")
                        k.classList.add("oldhp")
                        j = k.style
                        m = "" + C.d.R(m / 4) + "px"
                        j.width = m
                        i = l.createElement("div")
                        i.classList.add("hp")
                        m = i.style
                        l = "" + C.d.R(o.d / 4) + "px"
                        m.width = l
                        max_hp_element.appendChild(k)
                        max_hp_element.appendChild(i)
                    } else {
                        l = document
                        h = l.createElement("div")
                        h.classList.add("healhp")
                        j = h.style
                        g = "" + C.d.R(o.d / 4) + "px"
                        j.width = g
                        i = l.createElement("div")
                        i.classList.add("hp")
                        l = i.style
                        m = "" + C.d.R(m / 4) + "px"
                        l.width = m
                        max_hp_element.appendChild(h)
                        max_hp_element.appendChild(i)
                    }
                } else if (o instanceof T.DPlr) {
                    q.a(span_element.querySelector(".name")).classList.add("namedie")
                }
            }
            return span_element
        },
        // MARK: html render init
        inner_render: function inner_render(plist, pbody, profiler, randomer) {
            var _ = this
            _.a = plist
            _.b = pbody
            _.c = profiler // 输入的 profiler
            _.d = null
            _.f = _.e = false
            _.r = 3
            _.x = randomer
            _.y = 2
            // 既然加速之后就直接 2000
            // 直接初始化为 2000 如何
            // _.y = 2000
            // 当我没说, 没用
            _.Q = _.z = null
            _.ch = 0
            _.cx = null
            _.cy = true
            _.db = null
            _.dx = true
        },
        jx: function jx(a) {
            this.a = a
        },
        jy: function jy() { },
        jw: function jw() { },
        jA: function jA(a, b, c, d) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
        },
        jz: function jz(a) {
            this.a = a
        },
        jB: function jB() { },
        jC: function jC() { },
        jD: function jD(a) {
            this.a = a
        },
        send_win_data: function jE(a, b, c, d, e) {
            var _ = this
            _.a = a
            _.b = b
            _.c = c
            _.d = d
            _.e = e
        },
        jT: function jT(a) {
            this.a = a
            this.b = null
        },
        ax: function ax(a, b, c, d, e, f, g, h) {
            var _ = this
            _.a = a
            _.b = null
            _.d = _.c = 0
            _.e = null
            _.f = b
            _.r = null
            _.x = c
            _.y = d
            _.z = e
            _.Q = f
            _.ch = g
            _.cx = h
            _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = null
            _.go = 0
        },
        jV: function jV(a, b) {
            this.a = a
            this.b = b
        },
        fW: function fW(a, b, c, d, e, f, g, h) {
            var _ = this
            _.a = a
            _.b = null
            _.d = _.c = 0
            _.e = null
            _.f = b
            _.r = null
            _.x = c
            _.y = d
            _.z = e
            _.Q = f
            _.ch = g
            _.cx = h
            _.fy = _.fx = _.fr = _.dy = _.dx = _.db = _.cy = null
            _.go = 0
        },
        lp: function lp(a, b) {
            this.a = a
            this.b = b
        },
        lq: function lq(a, b) {
            this.a = a
            this.b = b
        }
    }
var w = [A, C, Sgls, H, J, L, LangData, P, S, T, V, W, X, Y, HtmlRenderer]

var $ = {}
H.m8.prototype = {}
J.Interceptor.prototype = {
    aW(a, b) {
        return a === b
    },
    gak(a) {
        return H.Primitives_objectHashCode(a)
    },
    k(a) {
        return "Instance of '" + H.as_string(H.jZ(a)) + "'"
    }
}
J.fw.prototype = {
    k(a) {
        return String(a)
    },
    gak(a) {
        return a ? 519018 : 218159
    },
    $iac: 1
}
J.cs.prototype = {
    aW(a, b) {
        return null == b
    },
    k(a) {
        return "null"
    },
    gak(a) {
        return 0
    },
    gcw(a) {
        return C.S
    },
    $iN: 1
}
J.bE.prototype = {
    gak(a) {
        return 0
    },
    k(a) {
        return String(a)
    },
    $inM: 1
}
J.PlainJavaScriptObject.prototype = {}
J.UnknownJavaScriptObject.prototype = {}
J.JavaScriptFunction.prototype = {
    k(a) {
        var s = a[$.oR()]
        if (s == null) return this.dQ(a)
        return "JavaScript function for " + H.as_string(J.b4(s))
    }
}
J.JsArray.prototype = {
    j(a, b) {
        if (!!a.fixed$length) H.throw_expression(P.UnsupportError("add"))
        a.push(b)
    },
    cu(a, b) {
        var s
        if (!!a.fixed$length) H.throw_expression(P.UnsupportError("removeAt"))
        s = a.length
        if (b >= s) throw H.wrap_expression(P.k0(b, null))
        return a.splice(b, 1)[0]
    },
    co(a, b, c) {
        if (!!a.fixed$length) H.throw_expression(P.UnsupportError("insert"))
        if (b < 0 || b > a.length) throw H.wrap_expression(P.k0(b, null))
        a.splice(b, 0, c)
    },
    U(a, b) {
        var s
        if (!!a.fixed$length) H.throw_expression(P.UnsupportError("remove"))
        for (s = 0; s < a.length; ++s)
            if (J.Y(a[s], b)) {
                a.splice(s, 1)
                return true
            } return false
    },
    // push all elements of b to a
    a5(a, b) {
        var s, r
        if (a.fixed$length) H.throw_expression(P.UnsupportError("addAll"))
        if (Array.isArray(b)) {
            this.ea(a, b)
            return
        }
        for (s = b.length, r = 0; r < b.length; b.length === s || (0, H.F)(b), ++r) a.push(b[r])
    },
    // push all elements of b to a
    ea(a, b) {
        var s, r = b.length
        if (r === 0) return
        if (a === b) throw H.wrap_expression(P.aK(a))
        for (s = 0; s < r; ++s) a.push(b[s])
    },
    f5(a, b, c) {
        return new H.y(a, b, H._arrayInstanceType(a).i("@<1>").aL(c).i("y<1,2>"))
    },
    aV(a, b) {
        var s, r = P.aL(a.length, "", false, t.N)
        for (s = 0; s < a.length; ++s) r[s] = H.as_string(a[s])
        return r.join(b)
    },
    dz(a, b) {
        var s, r, q = a.length
        if (q === 0) throw H.wrap_expression(H.fu())
        s = a[0]
        for (r = 1; r < q; ++r) {
            s = b.$2(s, a[r])
            if (q !== a.length) throw H.wrap_expression(P.aK(a))
        }
        return s
    },
    dl(a, b) {
        var s, r, q = a.length
        for (s = 0; s < q; ++s) {
            r = a[s]
            if (b.$1(r)) return r
            if (a.length !== q) throw H.wrap_expression(P.aK(a))
        }
        throw H.wrap_expression(H.fu())
    },
    ai(a, b) {
        return a[b]
    },
    al(a, b, c) {
        var s
        if (b == null) H.throw_expression(H.R(b))
        if (!H.aP(b)) throw H.wrap_expression(H.R(b))
        s = a.length
        if (b > s) throw H.wrap_expression(P.a8(b, 0, s, "start", null))
        if (c == null) c = s
        else if (c < b || c > s) throw H.wrap_expression(P.a8(c, b, s, "end", null))
        if (b === c) return H.b([], H._arrayInstanceType(a))
        return H.b(a.slice(b, c), H._arrayInstanceType(a))
    },
    cL(a, b) {
        return this.al(a, b, null)
    },
    geT(a) {
        if (a.length > 0) return a[0]
        throw H.wrap_expression(H.fu())
    },
    gbl(a) {
        var s = a.length
        if (s > 0) return a[s - 1]
        throw H.wrap_expression(H.fu())
    },
    df(a, b) {
        var s, r = a.length
        for (s = 0; s < r; ++s) {
            if (b.$1(a[s])) return true
            if (a.length !== r) throw H.wrap_expression(P.aK(a))
        }
        return false
    },
    bb(a, b) {
        if (!!a.immutable$list) H.throw_expression(P.UnsupportError("sort"))
        H.tJ(a, b == null ? J.bO() : b)
    },
    aJ(a) {
        return this.bb(a, null)
    },
    aT(a, b) {
        var s, r = a.length
        if (0 >= r) return -1
        for (s = 0; s < r; ++s)
            if (J.Y(a[s], b)) return s
        return -1
    },
    w(a, b) {
        var s
        for (s = 0; s < a.length; ++s)
            // if (J.Y(a[s], b)) return true
            if (a[s] === b) {
                return true
            }
        return false
    },
    k(a) {
        return P.IterableBase_iterableToFullString(a, "[", "]")
    },
    ga0(a) {
        return new J.db(a, a.length)
    },
    gak(a) {
        return H.Primitives_objectHashCode(a)
    },
    gp(a) {
        return a.length
    },
    sp(a, b) {
        if (a.fixed$length) {
            H.throw_expression(P.UnsupportError("set length"))
        }
        if (!H.aP(b)) throw H.wrap_expression(P.da(b, "newLength", null))
        a.length = b
    },
    h(a, b) {
        if (!H.aP(b)) throw H.wrap_expression(H.bQ(a, b))
        if (b >= a.length || b < 0) throw H.wrap_expression(H.bQ(a, b))
        return a[b]
    },
    m(a, b, c) {
        if (a.immutable$list) H.throw_expression(P.UnsupportError("indexed set"))
        if (!H.aP(b)) throw H.wrap_expression(H.bQ(a, b))
        if (b >= a.length || b < 0) throw H.wrap_expression(H.bQ(a, b))
        a[b] = c
    },
    $iA: 1,
    $iw: 1
}
J.JsUnmodifiableArray.prototype = {}
J.db.prototype = {
    gC() {
        return this.d
    },
    u() {
        var s, r = this,
            q = r.a,
            p = q.length
        if (r.b !== p) throw H.wrap_expression(H.F(q))
        s = r.c
        if (s >= p) {
            r.d = null
            return false
        }
        r.d = q[s]
        r.c = s + 1
        return true
    }
}
J.JsNumber.prototype = {
    bg(a, b) {
        var s
        if (typeof b != "number") throw H.wrap_expression(H.R(b))
        if (a < b) return -1
        else if (a > b) return 1
        else if (a === b) {
            if (a === 0) {
                s = this.gcp(b)
                if (this.gcp(a) === s) return 0
                if (this.gcp(a)) return -1
                return 1
            }
            return 0
        } else if (isNaN(a)) {
            if (isNaN(b)) return 0
            return 1
        } else return -1
    },
    gcp(a) {
        return a === 0 ? 1 / a < 0 : a < 0
    },
    R(a) {
        var s, r
        if (a >= 0) {
            if (a <= 2147483647) {
                s = a | 0
                return a === s ? s : s + 1
            }
        } else if (a >= -2147483648) return a | 0
        r = Math.ceil(a)
        if (isFinite(r)) return r
        throw H.wrap_expression(P.UnsupportError("" + a + ".ceil()"))
    },
    eW(a) {
        var s, r
        if (a >= 0) {
            if (a <= 2147483647) return a | 0
        } else if (a >= -2147483648) {
            s = a | 0
            return a === s ? s : s - 1
        }
        r = Math.floor(a)
        if (isFinite(r)) return r
        throw H.wrap_expression(P.UnsupportError("" + a + ".floor()"))
    },
    aI(a) {
        if (a > 0) {
            if (a !== 1 / 0) return Math.round(a)
        } else if (a > -1 / 0) return 0 - Math.round(0 - a)
        throw H.wrap_expression(P.UnsupportError("" + a + ".round()"))
    },
    k(a) {
        if (a === 0 && 1 / a < 0) return "-0.0"
        else return "" + a
    },
    gak(a) {
        var s, r, q, p, o = a | 0
        if (a === o) return o & 536870911
        s = Math.abs(a)
        r = Math.log(s) / 0.6931471805599453 | 0
        q = Math.pow(2, r)
        p = s < 1 ? s / q : q / s
        return ((p * 9007199254740992 | 0) + (p * 3542243181176521 | 0)) * 599197 + r * 1259 & 536870911
    },
    V(a, b) {
        var s
        if (typeof b != "number") throw H.wrap_expression(H.R(b))
        s = a % b
        if (s === 0) return 0
        if (s > 0) return s
        if (b < 0) return s - b
        else return s + b
    },
    P(a, b) {
        if (typeof b != "number") throw H.wrap_expression(H.R(b))
        if ((a | 0) === a)
            if (b >= 1 || b < -1) return a / b | 0
        return this.d6(a, b)
    },
    ag(a, b) {
        return (a | 0) === a ? a / b | 0 : this.d6(a, b)
    },
    d6(a, b) {
        var s = a / b
        if (s >= -2147483648 && s <= 2147483647) return s | 0
        if (s > 0) {
            if (s !== 1 / 0) return Math.floor(s)
        } else if (s > -1 / 0) return Math.ceil(s)
        throw H.wrap_expression(P.UnsupportError("Result of truncating division is " + H.as_string(s) + ": " + H.as_string(a) + " ~/ " + b))
    },
    bX(a, b) {
        if (typeof b != "number") throw H.wrap_expression(H.R(b))
        if (b < 0) throw H.wrap_expression(H.R(b))
        return b > 31 ? 0 : a << b >>> 0
    },
    ez(a, b) {
        return b > 31 ? 0 : a << b >>> 0
    },
    am(a, b) {
        var s
        if (a > 0) s = this.d5(a, b)
        else {
            s = b > 31 ? 31 : b
            s = a >> s >>> 0
        }
        return s
    },
    d5(a, b) {
        return b > 31 ? 0 : a >>> b
    }
}
J.JsInt.prototype = {
    $il: 1
}
J.jF.prototype = {}
J.JsString.prototype = {
    aQ(a, b) {
        if (!H.aP(b)) throw H.wrap_expression(H.bQ(a, b))
        if (b < 0) throw H.wrap_expression(H.bQ(a, b))
        if (b >= a.length) H.throw_expression(H.bQ(a, b))
        return a.charCodeAt(b)
    },
    a8(a, b) {
        if (b >= a.length) throw H.wrap_expression(H.bQ(a, b))
        return a.charCodeAt(b)
    },
    bK(a, b, c) {
        var s = b.length
        if (c > s) throw H.wrap_expression(P.a8(c, 0, s, null, null))
        return new H.ip(b, a, c)
    },
    de(a, b) {
        return this.bK(a, b, 0)
    },
    dq(a, b, c) {
        var s, r, q = null,
            p = b.length
        if (c > p) throw H.wrap_expression(P.a8(c, 0, p, q, q))
        s = a.length
        if (c + s > p) return q
        for (r = 0; r < s; ++r)
            if (this.a8(b, c + r) !== this.a8(a, r)) return q
        return new H.bK(c, a)
    },
    B(a, b) {
        if (typeof b != "string") throw H.wrap_expression(P.da(b, null, null))
        return a + b
    },
    cl(a, b) {
        var s, r
        if (typeof b != "string") H.throw_expression(H.R(b))
        s = b.length
        r = a.length
        if (s > r) return false
        return b === this.ay(a, r - s)
    },
    fu(a, b, c) {
        P.tp(0, 0, a.length, "startIndex")
        return H.iG(a, b, c, 0)
    },
    cK(a, b) {
        if (b == null) H.throw_expression(H.R(b))
        if (typeof b == "string") return H.b(a.split(b), t.s)
        else if (b instanceof H.JSSyntaxRegExp && b.gep().exec("").length - 2 === 0) return H.b(a.split(b.b), t.s)
        else return this.ek(a, b)
    },
    ek(a, b) {
        var s, r, q, p, o, n, m = H.b([], t.s)
        for (s = J.lU(b, a), s = s.ga0(s), r = 0, q = 1; s.u();) {
            p = s.gC()
            o = p.gbc(p)
            n = p.gbh()
            q = n - o
            if (q === 0 && r === o) continue
            m.push(this.af(a, r, o))
            r = n
        }
        if (r < a.length || q > 0) m.push(this.ay(a, r))
        return m
    },
    bA(a, b) {
        var s
        if (typeof b == "string") {
            s = b.length
            if (s > a.length) return false
            return b === a.substring(0, s)
        }
        return J.rw(b, a, 0) != null
    },
    af(a, b, c) {
        if (!H.aP(b)) H.throw_expression(H.R(b))
        return a.substring(b, P.cE(b, c, a.length))
    },
    ay(a, b) {
        return this.af(a, b, null)
    },
    fN(a) {
        return a.toLowerCase()
    },
    trim_name(a) {
        // trim unicode 133(\n)
        var s, r, q, p = a.trim(),
            o = p.length
        if (o === 0) return p
        if (this.a8(p, 0) === 133) {
            s = J.check_from_start(p, 1)
            if (s === o) return ""
        } else s = 0
        r = o - 1
        q = this.aQ(p, r) === 133 ? J.check_from_end(p, r) : o
        if (s === 0 && q === o) return p
        return p.substring(s, q)
    },
    cG(a, b) {
        var s, r
        if (0 >= b) return ""
        if (b === 1 || a.length === 0) return a
        if (b !== b >>> 0) throw H.wrap_expression(C.D)
        for (s = a, r = ""; true;) {
            if ((b & 1) === 1) r = s + r
            b = b >>> 1
            if (b === 0) break
            s += s
        }
        return r
    },
    fh(a, b, c) {
        var s = b - a.length
        if (s <= 0) return a
        return this.cG(c, s) + a
    },
    aT(a, b) {
        var s, r, q
        if (b == null) H.throw_expression(H.R(b))
        s = a.length
        if (typeof b == "string") return a.indexOf(b, 0)
        for (r = J.aQ(b), q = 0; q <= s; ++q)
            if (r.dq(b, a, q) != null) return q
        return -1
    },
    dh(a, b, c) {
        var s
        if (b == null) H.throw_expression(H.R(b))
        s = a.length
        if (c > s) throw H.wrap_expression(P.a8(c, 0, s, null, null))
        return H.iF(a, b, c)
    },
    w(a, b) {
        return this.dh(a, b, 0)
    },
    bg(a, b) {
        var s
        if (typeof b != "string") throw H.wrap_expression(H.R(b))
        if (a === b) s = 0
        else s = a < b ? -1 : 1
        return s
    },
    k(a) {
        return a
    },
    gak(a) {
        var s, r, q
        for (s = a.length, r = 0, q = 0; q < s; ++q) {
            r = r + a.charCodeAt(q) & 536870911
            r = r + ((r & 524287) << 10) & 536870911
            r ^= r >> 6
        }
        r = r + ((r & 67108863) << 3) & 536870911
        r ^= r >> 11
        return r + ((r & 16383) << 15) & 536870911
    },
    gp(a) {
        return a.length
    },
    $ifN: 1,
    $im: 1
}
H.fz.prototype = {
    k(a) {
        var s = "LateInitializationError: " + this.a
        return s
    }
}
H.ff.prototype = {
    gp(a) {
        return this.a.length
    },
    h(a, b) {
        return C.String.aQ(this.a, b)
    }
}
H.dO.prototype = {
    k(a) {
        return "Null is not a valid value for the parameter '" + this.a + "' of type '" + H.mz(this.$ti.c).k(0) + "'"
    },
    $ibc: 1
}
H.A.prototype = {}
H.M.prototype = {
    ga0(a) {
        return new H.cv(this, this.gp(this))
    },
    aV(a, b) {
        var s, r, q, p = this,
            o = p.gp(p)
        if (b.length !== 0) {
            if (o === 0) return ""
            s = H.as_string(p.ai(0, 0))
            if (o !== p.gp(p)) throw H.wrap_expression(P.aK(p))
            for (r = s, q = 1; q < o; ++q) {
                r = r + b + H.as_string(p.ai(0, q))
                if (o !== p.gp(p)) throw H.wrap_expression(P.aK(p))
            }
            return r.charCodeAt(0) == 0 ? r : r
        } else {
            for (q = 0, r = ""; q < o; ++q) {
                r += H.as_string(p.ai(0, q))
                if (o !== p.gp(p)) throw H.wrap_expression(P.aK(p))
            }
            return r.charCodeAt(0) == 0 ? r : r
        }
    },
    f3(a) {
        return this.aV(a, "")
    },
    bV(a, b) {
        return this.dP(0, b)
    },
    fM(a, b) {
        return P.List_List_of(this, true, H._instanceType(this).i("M.E"))
    },
    fL(a) {
        return this.fM(a, true)
    }
}
H.cv.prototype = {
    gC() {
        return this.d
    },
    u() {
        var s, r = this,
            q = r.a,
            p = J.a3(q),
            o = p.gp(q)
        if (r.b !== o) throw H.wrap_expression(P.aK(q))
        s = r.c
        if (s >= o) {
            r.d = null
            return false
        }
        r.d = p.ai(q, s);
        ++r.c
        return true
    }
}
H.c6.prototype = {
    ga0(a) {
        return new H.fB(J.by(this.a), this.b)
    },
    gp(a) {
        return J.aw(this.a)
    }
}
H.dr.prototype = {
    $iA: 1
}
H.fB.prototype = {
    u() {
        var s = this,
            r = s.b
        if (r.u()) {
            s.a = s.c.$1(r.gC())
            return true
        }
        s.a = null
        return false
    },
    gC() {
        return this.a
    }
}
H.y.prototype = {
    gp(a) {
        return J.aw(this.a)
    },
    ai(a, b) {
        return this.b.$1(J.ru(this.a, b))
    }
}
H.cf.prototype = {
    ga0(a) {
        return new H.hX(J.by(this.a), this.b)
    }
}
H.hX.prototype = {
    u() {
        var s, r
        for (s = this.a, r = this.b; s.u();)
            if (r.$1(s.gC())) return true
        return false
    },
    gC() {
        return this.a.gC()
    }
}
H.du.prototype = {
    sp(a, b) {
        throw H.wrap_expression(P.UnsupportError("Cannot change the length of a fixed-length list"))
    }
}
H.hV.prototype = {
    m(a, b, c) {
        throw H.wrap_expression(P.UnsupportError("Cannot modify an unmodifiable list"))
    },
    sp(a, b) {
        throw H.wrap_expression(P.UnsupportError("Cannot change the length of an unmodifiable list"))
    }
}
H.cJ.prototype = {}
H.a9.prototype = {
    gp(a) {
        return J.aw(this.a)
    },
    ai(a, b) {
        var s = this.a,
            r = J.a3(s)
        return r.ai(s, r.gp(s) - 1 - b)
    }
}
H.kh.prototype = {
    aH(a) {
        var s, r, q = this,
            p = new RegExp(q.a).exec(a)
        if (p == null) return null
        s = Object.create(null)
        r = q.b
        if (r !== -1) s.arguments = p[r + 1]
        r = q.c
        if (r !== -1) s.argumentsExpr = p[r + 1]
        r = q.d
        if (r !== -1) s.expr = p[r + 1]
        r = q.e
        if (r !== -1) s.method = p[r + 1]
        r = q.f
        if (r !== -1) s.receiver = p[r + 1]
        return s
    }
}
H.NullError.prototype = {
    k(a) {
        var s = this.b
        if (s == null) return "NoSuchMethodError: " + H.as_string(this.a)
        return "NoSuchMethodError: method not found: '" + s + "' on null"
    }
}
H.fx.prototype = {
    k(a) {
        var s, r = this,
            q = "NoSuchMethodError: method not found: '",
            p = r.b
        if (p == null) return "NoSuchMethodError: " + H.as_string(r.a)
        s = r.c
        if (s == null) return q + p + "' (" + H.as_string(r.a) + ")"
        return q + p + "' on '" + s + "' (" + H.as_string(r.a) + ")"
    }
}
H.hU.prototype = {
    k(a) {
        var s = this.a
        return s.length === 0 ? "Error" : "Error: " + s
    }
}
H.jR.prototype = {
    k(a) {
        return "Throw of null ('" + (this.a === null ? "null" : "undefined") + "' from JavaScript)"
    }
}
H.dt.prototype = {}
H.eE.prototype = {
    k(a) {
        var s, r = this.b
        if (r != null) return r
        r = this.a
        s = r !== null && typeof r === "object" ? r.stack : null
        return this.b = s == null ? "" : s
    },
    $iba: 1
}
H.c_.prototype = {
    k(a) {
        var s = this.constructor,
            r = s == null ? null : s.name
        return "Closure '" + H.oP(r == null ? "unknown" : r) + "'"
    },
    gfR() {
        return this
    },
    $C: "$1",
    $R: 1,
    $D: null
}
H.j5.prototype = {
    $C: "$0",
    $R: 0
}
H.j6.prototype = {
    $C: "$2",
    $R: 2
}
H.kg.prototype = {}
H.kc.prototype = {
    k(a) {
        var s = this.$static_name
        if (s == null) return "Closure of unknown static method"
        return "Closure '" + H.oP(s) + "'"
    }
}
H.dg.prototype = {
    aW(a, b) {
        if (b == null) return false
        if (this === b) return true
        if (!(b instanceof H.dg)) return false
        return this.$_target === b.$_target && this.a === b.a
    },
    gak(a) {
        return (H.vd(this.a) ^ H.Primitives_objectHashCode(this.$_target)) >>> 0
    },
    k(a) {
        return "Closure '" + H.as_string(this.$_name) + "' of " + ("Instance of '" + H.as_string(H.jZ(this.a)) + "'")
    }
}
H.h3.prototype = {
    k(a) {
        return "RuntimeError: " + this.a
    }
}
H.aT.prototype = {
    gp(a) {
        return this.a
    },
    gbv(a) {
        return this.a === 0
    },
    gad(a) {
        return new H.dC(this, H._instanceType(this).i("dC<1>"))
    },
    gfP(a) {
        var s = this,
            r = H._instanceType(s)
        return H.t5(s.gad(s), new H.jH(s), r.c, r.Q[1])
    },
    J(a, b) {
        var s, r
        if (typeof b == "string") {
            s = this.b
            if (s == null) return false
            return this.ei(s, b)
        } else {
            r = this.f_(b)
            return r
        }
    },
    f_(a) {
        var s = this,
            r = s.d
        if (r == null) return false
        return s.bR(s.bG(r, s.bQ(a)), a) >= 0
    },
    h(a, b) {
        var s, r, q, p, o = this,
            n = null
        if (typeof b == "string") {
            s = o.b
            if (s == null) return n
            r = o.bp(s, b)
            q = r == null ? n : r.b
            return q
        } else if (typeof b == "number" && (b & 0x3ffffff) === b) {
            p = o.c
            if (p == null) return n
            r = o.bp(p, b)
            q = r == null ? n : r.b
            return q
        } else return o.f0(b)
    },
    f0(a) {
        var s, r, q = this,
            p = q.d
        if (p == null) return null
        s = q.bG(p, q.bQ(a))
        r = q.bR(s, a)
        if (r < 0) return null
        return s[r].b
    },
    m(a, b, c) {
        var s, r, q = this
        if (typeof b == "string") {
            s = q.b
            q.cQ(s == null ? q.b = q.ca() : s, b, c)
        } else if (typeof b == "number" && (b & 0x3ffffff) === b) {
            r = q.c
            q.cQ(r == null ? q.c = q.ca() : r, b, c)
        } else q.f2(b, c)
    },
    f2(a, b) {
        var s, r, q, p = this,
            o = p.d
        if (o == null) o = p.d = p.ca()
        s = p.bQ(a)
        r = p.bG(o, s)
        if (r == null) p.cd(o, s, [p.c_(a, b)])
        else {
            q = p.bR(r, a)
            if (q >= 0) r[q].b = b
            else r.push(p.c_(a, b))
        }
    },
    U(a, b) {
        var s
        if (typeof b == "string") return this.eu(this.b, b)
        else {
            s = this.f1(b)
            return s
        }
    },
    f1(a) {
        var s, r, q, p, o = this,
            n = o.d
        if (n == null) return null
        s = o.bQ(a)
        r = o.bG(n, s)
        q = o.bR(r, a)
        if (q < 0) return null
        p = r.splice(q, 1)[0]
        o.d9(p)
        if (r.length === 0) o.c4(n, s)
        return p.b
    },
    ah(a) {
        var s = this
        if (s.a > 0) {
            s.b = s.c = s.d = s.e = s.f = null
            s.a = 0
            s.c9()
        }
    },
    aw(a, b) {
        var this_ = this,
            r = this_.e,
            q = this_.r
        for (; r != null;) {
            // 频率输出 call
            b.$2(r.a, r.b)
            if (q !== this_.r) {
                throw H.wrap_expression(P.aK(this_))
            }
            r = r.c
        }
    },
    cQ(a, b, c) {
        var s = this.bp(a, b)
        if (s == null) this.cd(a, b, this.c_(b, c))
        else s.b = c
    },
    eu(a, b) {
        var s
        if (a == null) return null
        s = this.bp(a, b)
        if (s == null) return null
        this.d9(s)
        this.c4(a, b)
        return s.b
    },
    c9() {
        this.r = this.r + 1 & 67108863
    },
    c_(a, b) {
        var s, r = this,
            q = new H.jK(a, b)
        if (r.e == null) r.e = r.f = q
        else {
            s = r.f
            s.toString
            q.d = s
            r.f = s.c = q
        } ++r.a
        r.c9()
        return q
    },
    d9(a) {
        var s = this,
            r = a.d,
            q = a.c
        if (r == null) s.e = q
        else r.c = q
        if (q == null) s.f = r
        else q.d = r;
        --s.a
        s.c9()
    },
    bQ(a) {
        return J.lZ(a) & 0x3ffffff
    },
    bR(a, b) {
        var s, r
        if (a == null) return -1
        s = a.length
        for (r = 0; r < s; ++r)
            if (J.Y(a[r].a, b)) return r
        return -1
    },
    k(a) {
        return P.nR(this)
    },
    bp(a, b) {
        return a[b]
    },
    bG(a, b) {
        return a[b]
    },
    cd(a, b, c) {
        a[b] = c
    },
    c4(a, b) {
        delete a[b]
    },
    ei(a, b) {
        return this.bp(a, b) != null
    },
    ca() {
        var s = "<non-identifier-key>",
            r = Object.create(null)
        this.cd(r, s, r)
        this.c4(r, s)
        return r
    }
}
H.jH.prototype = {
    $1(a) {
        return this.a.h(0, a)
    },
    $S() {
        return H._instanceType(this.a).i("2(1)")
    }
}
H.jK.prototype = {}
H.dC.prototype = {
    gp(a) {
        return this.a.a
    },
    ga0(a) {
        var s = this.a,
            r = new H.fA(s, s.r)
        r.c = s.e
        return r
    }
}
H.fA.prototype = {
    gC() {
        return this.d
    },
    u() {
        var s, r = this,
            q = r.a
        if (r.b !== q.r) throw H.wrap_expression(P.aK(q))
        s = r.c
        if (s == null) {
            r.d = null
            return false
        } else {
            r.d = s.a
            r.c = s.c
            return true
        }
    }
}
H.lv.prototype = {
    $1(a) {
        return this.a(a)
    },
    $S: 28
}
H.lw.prototype = {
    $2(a, b) {
        return this.a(a, b)
    },
    $S: 48
}
H.lx.prototype = {
    $1(a) {
        return this.a(a)
    },
    $S: 58
}
H.JSSyntaxRegExp.prototype = {
    k(a) {
        return "RegExp/" + this.a + "/" + this.b.flags
    },
    geq() {
        var s = this,
            r = s.c
        if (r != null) return r
        r = s.b
        return s.c = H.JSSyntaxRegExp_makeNative(s.a, r.multiline, !r.ignoreCase, r.unicode, r.dotAll, true)
    },
    gep() {
        var s = this,
            r = s.d
        if (r != null) return r
        r = s.b
        return s.d = H.JSSyntaxRegExp_makeNative(s.a + "|()", r.multiline, !r.ignoreCase, r.unicode, r.dotAll, true)
    },
    eU(a) {
        var s
        if (typeof a != "string") H.throw_expression(H.R(a))
        s = this.b.exec(a)
        if (s == null) return null
        return new H.ew(s)
    },
    bK(a, b, c) {
        var s = b.length
        if (c > s) throw H.wrap_expression(P.a8(c, 0, s, null, null))
        return new H.hZ(this, b, c)
    },
    de(a, b) {
        return this.bK(a, b, 0)
    },
    d_(a, b) {
        var s, r = this.geq()
        r.lastIndex = b
        s = r.exec(a)
        if (s == null) return null
        return new H.ew(s)
    },
    $ifN: 1,
    $io0: 1
}
H.ew.prototype = {
    gbc(a) {
        return this.b.index
    },
    gbh() {
        var s = this.b
        return s.index + s[0].length
    },
    cF(a) {
        return this.b[a]
    },
    $ic7: 1
}
H.hZ.prototype = {
    ga0(a) {
        return new H.kz(this.a, this.b, this.c)
    }
}
H.kz.prototype = {
    gC() {
        return this.d
    },
    u() {
        var s, r, q, p, o, n = this,
            m = n.b
        if (m == null) return false
        s = n.c
        r = m.length
        if (s <= r) {
            q = n.a
            p = q.d_(m, s)
            if (p != null) {
                n.d = p
                o = p.gbh()
                if (p.b.index === o) {
                    if (q.b.unicode) {
                        s = n.c
                        q = s + 1
                        if (q < r) {
                            s = C.String.aQ(m, s)
                            if (s >= 55296 && s <= 56319) {
                                s = C.String.aQ(m, q)
                                s = s >= 56320 && s <= 57343
                            } else s = false
                        } else s = false
                    } else s = false
                    o = (s ? o + 1 : o) + 1
                }
                n.c = o
                return true
            }
        }
        n.b = n.d = null
        return false
    }
}
H.bK.prototype = {
    gbh() {
        return this.a + this.c.length
    },
    cF(a) {
        if (a !== 0) throw H.wrap_expression(P.k0(a, null))
        return this.c
    },
    $ic7: 1,
    gbc(a) {
        return this.a
    }
}
H.ip.prototype = {
    ga0(a) {
        return new H.l3(this.a, this.b, this.c)
    }
}
H.l3.prototype = {
    u() {
        var s, r, this_ = this,
            p = this_.c,
            o = this_.b,
            n = o.length,
            m = this_.a,
            l = m.length
        if (p + n > l) {
            this_.d = null
            return false
        }
        s = m.indexOf(o, p)
        if (s < 0) {
            this_.c = l + 1
            this_.d = null
            return false
        }
        r = s + n
        this_.d = new H.bK(s, o)
        this_.c = r === this_.c ? r + 1 : r
        return true
    },
    gC() {
        var s = this.d
        s.toString
        return s
    }
}
H.dJ.prototype = {
    $idJ: 1
}
H.ab.prototype = {
    $iab: 1
}
H.NativeTypedArray.prototype = {
    gp(a) {
        return a.length
    },
    $iag: 1
}
H.NativeTypedArrayOfDouble.prototype = {
    h(a, b) {
        H._checkValidIndex(b, a, a.length)
        return a[b]
    },
    m(a, b, c) {
        H._checkValidIndex(b, a, a.length)
        a[b] = c
    },
    $iA: 1,
    $iw: 1
}
H.NativeTypedArrayOfInt.prototype = {
    m(a, b, c) {
        H._checkValidIndex(b, a, a.length)
        a[b] = c
    },
    $iA: 1,
    $iw: 1
}
H.fE.prototype = {
    h(a, b) {
        H._checkValidIndex(b, a, a.length)
        return a[b]
    }
}
H.fF.prototype = {
    h(a, b) {
        H._checkValidIndex(b, a, a.length)
        return a[b]
    }
}
H.fG.prototype = {
    h(a, b) {
        H._checkValidIndex(b, a, a.length)
        return a[b]
    }
}
H.fH.prototype = {
    h(a, b) {
        H._checkValidIndex(b, a, a.length)
        return a[b]
    }
}
H.fI.prototype = {
    h(a, b) {
        H._checkValidIndex(b, a, a.length)
        return a[b]
    }
}
H.dL.prototype = {
    gp(a) {
        return a.length
    },
    h(a, b) {
        H._checkValidIndex(b, a, a.length)
        return a[b]
    }
}
H.cx.prototype = {
    gp(a) {
        return a.length
    },
    h(a, b) {
        H._checkValidIndex(b, a, a.length)
        return a[b]
    },
    $icx: 1
}
H._NativeTypedArrayOfDouble_NativeTypedArray_ListMixin.prototype = {}
H._NativeTypedArrayOfDouble_NativeTypedArray_ListMixin_FixedLengthListMixin.prototype = {}
H._NativeTypedArrayOfInt_NativeTypedArray_ListMixin.prototype = {}
H._NativeTypedArrayOfInt_NativeTypedArray_ListMixin_FixedLengthListMixin.prototype = {}
H.Rti.prototype = {
    i(a) {
        return H._Universe_evalInEnvironment(init.typeUniverse, this, a)
    },
    aL(a) {
        return H._Universe_bind(init.typeUniverse, this, a)
    }
}
H.ib.prototype = {}
H.iu.prototype = {
    k(a) {
        return H.aH(this.a, null)
    }
}
H.i9.prototype = {
    k(a) {
        return this.a
    }
}
H.eI.prototype = {
    $ibc: 1
}
P.kB.prototype = {
    $1(a) {
        var s = this.a,
            r = s.a
        s.a = null
        r.$0()
    },
    $S: 22
}
P.kA.prototype = {
    $1(a) {
        var s, r
        this.a.a = a
        s = this.b
        r = this.c
        s.firstChild ? s.removeChild(r) : s.appendChild(r)
    },
    $S: 27
}
P.kC.prototype = {
    $0() {
        this.a.$0()
    },
    $S: 18
}
P.kD.prototype = {
    $0() {
        this.a.$0()
    },
    $S: 18
}
P.l8.prototype = {
    e8(a, b) {
        if (run_env.from_code) {
            // b.$0()
            // setTimeout
            setTimeout(H.convert_dart_closure_to_js_md5(new P.kC(b), 0), 0)
        } else {
            if (self.setTimeout != null) {
                // self.setTimeout(H.convert_dart_closure_to_js_md5(new P.l9(this, b), 0), a)
                self.setTimeout(H.convert_dart_closure_to_js_md5(new P._TimerImpl_internalCallback(this, b), 0), 0)
                // b.$0() // 草,这下…… 6
            } else {
                throw H.wrap_expression(P.UnsupportError("`setTimeout()` not found."))
            }
        }
    }
}
P._TimerImpl_internalCallback.prototype = {
    $0() {
        this.b.$0()
    },
    $S: 0
}
P.i_.prototype = {
    bM(a, b) {
        var s, r = this
        if (!r.b) r.a.cS(b)
        else {
            s = r.a
            if (r.$ti.i("bl<1>").b(b)) s.cW(b)
            else s.c2(b)
        }
    },
    cj(a, b) {
        var s
        if (b == null) b = P.AsyncError_defaultStackTrace(a)
        s = this.a
        if (this.b) s.be(a, b)
        else s.cT(a, b)
    }
}
P.lh.prototype = {
    $1(a) {
        return this.a.$2(0, a)
    },
    $S: 5
}
P.li.prototype = {
    $2(a, b) {
        this.a.$2(1, new H.dt(a, b))
    },
    $S: 60
}
P._wrapJsFunctionForAsync_closure.prototype = {
    $2(a, b) {
        this.a(a, b)
    },
    $S: 61
}
P.f3.prototype = {
    k(a) {
        return H.as_string(this.a)
    },
    $iO: 1,
    gbz() {
        return this.b
    }
}
P.jp.prototype = {
    $0() {
        this.b.cY(null)
    },
    $S: 0
}
P.i4.prototype = {
    cj(a, b) {
        var s
        H.ls(a, "error", t.K)
        s = this.a
        if ((s.a & 30) !== 0) throw H.wrap_expression(P.cd("Future already completed"))
        if (b == null) b = P.AsyncError_defaultStackTrace(a)
        s.cT(a, b)
    },
    dg(a) {
        return this.cj(a, null)
    }
}
P.cg.prototype = {
    bM(a, b) {
        var s = this.a
        if ((s.a & 30) !== 0) throw H.wrap_expression(P.cd("Future already completed"))
        s.cS(b)
    }
}
P.cN.prototype = {
    f6(a) {
        if ((this.c & 15) !== 6) return true
        return this.b.b.cv(this.d, a.a)
    },
    eZ(a) {
        var s, r = this.e,
            q = null,
            p = this.b.b
        if (t.C.b(r)) q = p.fC(r, a.a, a.b)
        else q = p.cv(r, a.a)
        try {
            p = q
            return p
        } catch (s) {
            if (t.eK.b(H.unwrap_Exception(s))) {
                if ((this.c & 1) !== 0) throw H.wrap_expression(P.bz("The error handler of Future.then must return a value of the returned future's type", "onError"))
                throw H.wrap_expression(P.bz("The error handler of Future.catchError must return a value of the future's type", "onError"))
            } else throw s
        }
    }
}
P._Future.prototype = {
    cz(a, b, c) {
        var s, r, q = $.P
        if (q === C.f) {
            if (b != null && !t.C.b(b) && !t.J.b(b)) throw H.wrap_expression(P.da(b, "onError", u.c))
        } else if (b != null) b = P.uz(b, q)
        s = new P._Future(q, c.i("U<0>"))
        r = b == null ? 1 : 3
        this.c0(new P.cN(s, r, a, b, this.$ti.i("@<1>").aL(c).i("cN<1,2>")))
        return s
    },
    fI(a, b) {
        return this.cz(a, null, b)
    },
    d7(a, b, c) {
        var s = new P._Future($.P, c.i("U<0>"))
        this.c0(new P.cN(s, 19, a, b, this.$ti.i("@<1>").aL(c).i("cN<1,2>")))
        return s
    },
    ex(a) {
        this.a = this.a & 1 | 16
        this.c = a
    },
    c1(a) {
        this.a = a.a & 30 | this.a & 1
        this.c = a.c
    },
    c0(a) {
        var s = this,
            r = s.a
        if (r <= 3) {
            a.a = s.c
            s.c = a
        } else {
            if ((r & 4) !== 0) {
                r = s.c
                if ((r.a & 24) === 0) {
                    r.c0(a)
                    return
                }
                s.c1(r)
            }
            P.cS(null, null, s.b, new P.kH(s, a))
        }
    },
    d3(a) {
        var s, r, q, p, o, n = this,
            m = {}
        m.a = a
        if (a == null) return
        s = n.a
        if (s <= 3) {
            r = n.c
            n.c = a
            if (r != null) {
                q = a.a
                for (p = a; q != null; p = q, q = o) o = q.a
                p.a = r
            }
        } else {
            if ((s & 4) !== 0) {
                s = n.c
                if ((s.a & 24) === 0) {
                    s.d3(a)
                    return
                }
                n.c1(s)
            }
            m.a = n.bJ(a)
            P.cS(null, null, n.b, new P.kO(m, n))
        }
    },
    bI() {
        var s = this.c
        this.c = null
        return this.bJ(s)
    },
    bJ(a) {
        var s, r, q
        for (s = a, r = null; s != null; r = s, s = q) {
            q = s.a
            s.a = r
        }
        return r
    },
    cV(a) {
        var s, r, q, p = this
        p.a ^= 2
        try {
            a.cz(new P.kK(p), new P.kL(p), t.P)
        } catch (q) {
            s = H.unwrap_Exception(q)
            r = H.getTraceFromException(q)
            P.oN(new P.kM(p, s, r))
        }
    },
    // 动画帧调用?
    cY(a) {
        var s = this,
            r = s.bI()
        s.a = 8
        s.c = a
        P.cO(s, r)
    },
    c2(a) {
        var s = this,
            r = s.bI()
        s.a = 8
        s.c = a
        P.cO(s, r)
    },
    be(a, b) {
        var s = this.bI()
        this.ex(P.async_error(a, b))
        P.cO(this, s)
    },
    cS(a) {
        if (this.$ti.i("bl<1>").b(a)) {
            this.cW(a)
            return
        }
        this.ed(a)
    },
    ed(a) {
        this.a ^= 2
        P.cS(null, null, this.b, new P.kJ(this, a))
    },
    cW(a) {
        var s = this
        if (s.$ti.b(a)) {
            if ((a.a & 16) !== 0) {
                s.a ^= 2
                P.cS(null, null, s.b, new P.kN(s, a))
            } else P.mk(a, s)
            return
        }
        s.cV(a)
    },
    cT(a, b) {
        this.a ^= 2
        P.cS(null, null, this.b, new P.kI(this, a, b))
    },
    $ibl: 1
}
P.kH.prototype = {
    $0() {
        P.cO(this.a, this.b)
    },
    $S: 0
}
P.kO.prototype = {
    $0() {
        P.cO(this.b, this.a.a)
    },
    $S: 0
}
P.kK.prototype = {
    $1(a) {
        var s, r, q, p = this.a
        p.a ^= 2
        try {
            p.c2(p.$ti.c.a(a))
        } catch (q) {
            s = H.unwrap_Exception(q)
            r = H.getTraceFromException(q)
            p.be(s, r)
        }
    },
    $S: 22
}
P.kL.prototype = {
    $2(a, b) {
        this.a.be(a, b)
    },
    $S: 32
}
P.kM.prototype = {
    $0() {
        this.a.be(this.b, this.c)
    },
    $S: 0
}
P.kJ.prototype = {
    $0() {
        this.a.c2(this.b)
    },
    $S: 0
}
P.kN.prototype = {
    $0() {
        P.mk(this.b, this.a)
    },
    $S: 0
}
P.kI.prototype = {
    $0() {
        this.a.be(this.b, this.c)
    },
    $S: 0
}
P.kR.prototype = {
    $0() {
        var s, r, q, p, o, n, m = this,
            l = null
        try {
            q = m.a.a
            l = q.b.b.fA(q.d)
        } catch (p) {
            s = H.unwrap_Exception(p)
            r = H.getTraceFromException(p)
            if (m.c) {
                q = m.b.a.c.a
                o = s
                o = q == null ? o == null : q === o
                q = o
            } else q = false
            o = m.a
            if (q) o.c = m.b.a.c
            else o.c = P.async_error(s, r)
            o.b = true
            return
        }
        if (l instanceof P._Future && (l.a & 24) !== 0) {
            if ((l.a & 16) !== 0) {
                q = m.a
                q.c = l.c
                q.b = true
            }
            return
        }
        if (t.h.b(l)) {
            n = m.b.a
            q = m.a
            q.c = l.fI(new P.kS(n), t.z)
            q.b = false
        }
    },
    $S: 0
}
P.kS.prototype = {
    $1(a) {
        return this.a
    },
    $S: 52
}
P.kQ.prototype = {
    $0() {
        var s, r, q, p, o
        try {
            q = this.a
            p = q.a
            q.c = p.b.b.cv(p.d, this.b)
        } catch (o) {
            s = H.unwrap_Exception(o)
            r = H.getTraceFromException(o)
            q = this.a
            q.c = P.async_error(s, r)
            q.b = true
        }
    },
    $S: 0
}
P.kP.prototype = {
    $0() {
        var s, r, q, p, o, n, m, l, k = this
        try {
            s = k.a.a.c
            p = k.b
            if (p.a.f6(s) && p.a.e != null) {
                p.c = p.a.eZ(s)
                p.b = false
            }
        } catch (o) {
            r = H.unwrap_Exception(o)
            q = H.getTraceFromException(o)
            p = k.a.a.c
            n = p.a
            m = r
            l = k.b
            if (n == null ? m == null : n === m) l.c = p
            else l.c = P.async_error(r, q)
            l.b = true
        }
    },
    $S: 0
}
P.i0.prototype = {}
P.em.prototype = {
    gp(a) {
        var s = {},
            r = new P._Future($.P, t.fJ)
        s.a = 0
        this.dn(new P.ke(s, this), true, new P.kf(s, r), r.geg())
        return r
    }
}
P.ke.prototype = {
    $1(a) {
        ++this.a.a
    },
    $S() {
        return H._instanceType(this.b).i("~(1)")
    }
}
P.kf.prototype = {
    $0() {
        this.b.cY(this.a.a)
    },
    $S: 0
}
P.hO.prototype = {}
P.hP.prototype = {}
P.im.prototype = {
    ger() {
        if ((this.b & 8) === 0) return this.a
        return this.a.gcC()
    },
    en() {
        var s, r = this
        if ((r.b & 8) === 0) {
            s = r.a
            return s == null ? r.a = new P.eG() : s
        }
        s = r.a.gcC()
        return s
    },
    geB() {
        var s = this.a
        return (this.b & 8) !== 0 ? s.gcC() : s
    },
    ee() {
        if ((this.b & 4) !== 0) return new P.bJ("Cannot add event after closing")
        return new P.bJ("Cannot add event while adding a stream")
    },
    eA(a, b, c, d) {
        var s, r, q, p, o, n = this
        if ((n.b & 3) !== 0) throw H.wrap_expression(P.cd("Stream has already been listened to."))
        s = $.P
        r = d ? 1 : 0
        P.tS(s, b)
        q = new P.i5(n, a, s, r)
        p = n.ger()
        s = n.b |= 1
        if ((s & 8) !== 0) {
            o = n.a
            o.scC(q)
            o.fw()
        } else n.a = q
        q.ey(p)
        s = q.e
        q.e = s | 32
        new P.l2(n).$0()
        q.e &= 4294967263
        q.cX((s & 4) !== 0)
        return q
    }
}
P.l2.prototype = {
    $0() {
        P.mu(this.a.d)
    },
    $S: 0
}
P.i1.prototype = {
    cc(a) {
        this.geB().ec(new P.er(a))
    }
}
P.cK.prototype = {}
P.cM.prototype = {
    gak(a) {
        return (H.Primitives_objectHashCode(this.a) ^ 892482866) >>> 0
    },
    aW(a, b) {
        if (b == null) return false
        if (this === b) return true
        return b instanceof P.cM && b.a === this.a
    }
}
P.i5.prototype = {
    d1() {
        var s = this.x
        if ((s.b & 8) !== 0) s.a.fS(0)
        P.mu(s.e)
    },
    d2() {
        var s = this.x
        if ((s.b & 8) !== 0) s.a.fw()
        P.mu(s.f)
    }
}
P.i3.prototype = {
    ey(a) {
        if (a == null) return
        this.r = a
        if (a.c != null) {
            this.e |= 64
            a.bW(this)
        }
    },
    d1() { },
    d2() { },
    ec(a) {
        var s, r = this,
            q = r.r
        if (q == null) q = new P.eG()
        r.r = q
        q.j(0, a)
        s = r.e
        if ((s & 64) === 0) {
            s |= 64
            r.e = s
            if (s < 128) q.bW(r)
        }
    },
    cc(a) {
        var s = this,
            r = s.e
        s.e = r | 32
        s.d.dC(s.a, a)
        s.e &= 4294967263
        s.cX((r & 4) !== 0)
    },
    cX(a) {
        var s, r, this_ = this,
            p = this_.e
        if ((p & 64) !== 0 && this_.r.c == null) {
            p = this_.e = p & 4294967231
            if ((p & 4) !== 0)
                if (p < 128) {
                    s = this_.r
                    s = s == null ? null : s.c == null
                    s = s !== false
                } else {
                    s = false
                }
            else {
                s = false
            }
            if (s) {
                p &= 4294967291
                this_.e = p
            }
        }
        for (; true; a = r) {
            if ((p & 8) !== 0) {
                this_.r = null
                return
            }
            r = (p & 4) !== 0
            if (a === r) break
            this_.e = p ^ 32
            if (r) this_.d1()
            else this_.d2()
            p = this_.e &= 4294967263
        }
        if ((p & 64) !== 0 && p < 128) {
            this_.r.bW(this_)
        }
    }
}
P.eF.prototype = {
    dn(a, b, c, d) {
        return this.a.eA(a, d, c, b === true)
    },
    f4(a) {
        return this.dn(a, null, null, null)
    }
}
P.i7.prototype = {}
P.er.prototype = {}
P.ii.prototype = {
    bW(a) {
        var s = this,
            r = s.a
        if (r === 1) return
        if (r >= 1) {
            s.a = 1
            return
        }
        P.oN(new P.kW(s, a))
        s.a = 1
    }
}
P.kW.prototype = {
    $0() {
        var s, r, q = this.a,
            p = q.a
        q.a = 0
        if (p === 3) return
        s = q.b
        r = s.a
        q.b = r
        if (r == null) q.c = null
        this.b.cc(s.b)
    },
    $S: 0
}
P.eG.prototype = {
    j(a, b) {
        var s = this,
            r = s.c
        if (r == null) s.b = s.c = b
        else s.c = r.a = b
    }
}
P.io.prototype = {}
P.lf.prototype = {}
P.lo.prototype = {
    $0() {
        var s = H.wrap_expression(this.a)
        s.stack = J.b4(this.b)
        throw s
    },
    $S: 0
}
P.kX.prototype = {
    fE(a) {
        var s, r, q
        try {
            if (C.f === $.P) {
                a.$0()
                return
            }
            P.os(null, null, this, a)
        } catch (q) {
            s = H.unwrap_Exception(q)
            r = H.getTraceFromException(q)
            P.iC(s, r)
        }
    },
    fG(a, b) {
        var s, r, q
        try {
            if (C.f === $.P) {
                a.$1(b)
                return
            }
            P.ot(null, null, this, a, b)
        } catch (q) {
            s = H.unwrap_Exception(q)
            r = H.getTraceFromException(q)
            P.iC(s, r)
        }
    },
    dC(a, b) {
        return this.fG(a, b, t.z)
    },
    cf(a) {
        return new P.kY(this, a)
    },
    eI(a, b) {
        return new P.kZ(this, a, b)
    },
    fB(a) {
        if ($.P === C.f) return a.$0()
        return P.os(null, null, this, a)
    },
    fA(a) {
        return this.fB(a, t.z)
    },
    fF(a, b) {
        if ($.P === C.f) return a.$1(b)
        return P.ot(null, null, this, a, b)
    },
    cv(a, b) {
        return this.fF(a, b, t.z, t.z)
    },
    fD(a, b, c) {
        if ($.P === C.f) return a.$2(b, c)
        return P.uA(null, null, this, a, b, c)
    },
    fC(a, b, c) {
        return this.fD(a, b, c, t.z, t.z, t.z)
    },
    fp(a) {
        return a
    },
    ct(a) {
        return this.fp(a, t.z, t.z, t.z)
    }
}
P.kY.prototype = {
    $0() {
        return this.a.fE(this.b)
    },
    $S: 0
}
P.kZ.prototype = {
    $1(a) {
        return this.a.dC(this.b, a)
    },
    $S() {
        return this.c.i("~(0)")
    }
}
P.eu.prototype = {
    ga0(a) {
        var s = new P.ie(this, this.r)
        s.c = this.e
        return s
    },
    gp(a) {
        return this.a
    },
    w(a, b) {
        var s, r
        if (typeof b == "string" && b !== "__proto__") {
            s = this.b
            if (s == null) return false
            return s[b] != null
        } else if (typeof b == "number" && (b & 1073741823) === b) {
            r = this.c
            if (r == null) return false
            return r[b] != null
        } else return this.eh(b)
    },
    eh(a) {
        var s = this.d
        if (s == null) return false
        return this.d0(s[this.cZ(a)], a) >= 0
    },
    j(a, b) {
        var s, r, q = this
        if (typeof b == "string" && b !== "__proto__") {
            s = q.b
            return q.cR(s == null ? q.b = P.ml() : s, b)
        } else if (typeof b == "number" && (b & 1073741823) === b) {
            r = q.c
            return q.cR(r == null ? q.c = P.ml() : r, b)
        } else return q.e9(b)
    },
    e9(a) {
        var s, r, q = this,
            p = q.d
        if (p == null) p = q.d = P.ml()
        s = q.cZ(a)
        r = p[s]
        if (r == null) p[s] = [q.cb(a)]
        else {
            if (q.d0(r, a) >= 0) return false
            r.push(q.cb(a))
        }
        return true
    },
    cR(a, b) {
        if (a[b] != null) return false
        a[b] = this.cb(b)
        return true
    },
    ef() {
        this.r = this.r + 1 & 1073741823
    },
    cb(a) {
        var s, r = this,
            q = new P.kV(a)
        if (r.e == null) r.e = r.f = q
        else {
            s = r.f
            s.toString
            q.c = s
            r.f = s.b = q
        } ++r.a
        r.ef()
        return q
    },
    cZ(a) {
        return J.lZ(a) & 1073741823
    },
    d0(a, b) {
        var s, r
        if (a == null) return -1
        s = a.length
        for (r = 0; r < s; ++r)
            // if (J.Y(a[r].a, b)) return r
            if (a[r].a === b) return r
        return -1
    }
}
P.kV.prototype = {}
P.ie.prototype = {
    gC() {
        return this.d
    },
    u() {
        var s = this,
            r = s.c,
            q = s.a
        if (s.b !== q.r) throw H.wrap_expression(P.aK(q))
        else if (r == null) {
            s.d = null
            return false
        } else {
            s.d = r.a
            s.c = r.b
            return true
        }
    }
}
P.dy.prototype = {}
P.dE.prototype = {
    $iA: 1,
    $iw: 1
}
P.z.prototype = {
    ga0(a) {
        return new H.cv(a, this.gp(a))
    },
    ai(a, b) {
        return this.h(a, b)
    },
    k(a) {
        return P.IterableBase_iterableToFullString(a, "[", "]")
    }
}
P.dG.prototype = {}
P.jM.prototype = {
    $2(a, b) {
        var s, r = this.a
        if (!r.a) this.b.a += ", "
        r.a = false
        r = this.b
        s = r.a += H.as_string(a)
        r.a = s + ": "
        r.a += H.as_string(b)
    },
    $S: 51
}
P.aU.prototype = {
    aw(a, b) {
        var s, r
        for (s = J.by(this.gad(a)); s.u();) {
            r = s.gC()
            b.$2(r, this.h(a, r))
        }
    },
    gp(a) {
        return J.aw(this.gad(a))
    },
    k(a) {
        return P.nR(a)
    },
    $ibo: 1
}
P.dY.prototype = {
    a5(a, b) {
        var s
        for (s = J.by(b); s.u();) this.j(0, s.gC())
    },
    k(a) {
        return P.IterableBase_iterableToFullString(this, "{", "}")
    }
}
P.eC.prototype = {
    $iA: 1
}
P.ev.prototype = {}
P.eM.prototype = {}
P.ic.prototype = {
    h(a, b) {
        var s, r = this.b
        if (r == null) return this.c.h(0, b)
        else if (typeof b != "string") return null
        else {
            s = r[b]
            return typeof s == "undefined" ? this.es(b) : s
        }
    },
    gp(a) {
        var s
        if (this.b == null) {
            s = this.c
            s = s.gp(s)
        } else s = this.bF().length
        return s
    },
    gad(a) {
        var s
        if (this.b == null) {
            s = this.c
            return s.gad(s)
        }
        return new P.id(this)
    },
    aw(a, b) {
        var s, r, q, p, o = this
        if (o.b == null) return o.c.aw(0, b)
        s = o.bF()
        for (r = 0; r < s.length; ++r) {
            q = s[r]
            p = o.b[q]
            if (typeof p == "undefined") {
                p = P.lk(o.a[q])
                o.b[q] = p
            }
            b.$2(q, p)
            if (s !== o.c) throw H.wrap_expression(P.aK(o))
        }
    },
    bF() {
        var s = this.c
        if (s == null) s = this.c = H.b(Object.keys(this.a), t.s)
        return s
    },
    es(a) {
        var s
        if (!Object.prototype.hasOwnProperty.call(this.a, a)) return null
        s = P.lk(this.a[a])
        return this.b[a] = s
    }
}
P.id.prototype = {
    gp(a) {
        var s = this.a
        return s.gp(s)
    },
    ai(a, b) {
        var s = this.a
        return s.b == null ? s.gad(s).ai(0, b) : s.bF()[b]
    },
    ga0(a) {
        var s = this.a
        if (s.b == null) {
            s = s.gad(s)
            s = s.ga0(s)
        } else {
            s = s.bF()
            s = new J.db(s, s.length)
        }
        return s
    }
}
P.km.prototype = {
    $0() {
        var s, r
        try {
            s = new TextDecoder("utf-8", {
                fatal: true
            })
            return s
        } catch (r) {
            H.unwrap_Exception(r)
        }
        return null
    },
    $S: 11
}
P.kl.prototype = {
    $0() {
        var s, r
        try {
            s = new TextDecoder("utf-8", {
                fatal: false
            })
            return s
        } catch (r) {
            H.unwrap_Exception(r)
        }
        return null
    },
    $S: 11
}
P.fg.prototype = {}
P.fi.prototype = {}
P.jg.prototype = {}
P.js.prototype = {
    k(a) {
        return "unknown"
    }
}
P.jr.prototype = {
    ab(a) {
        var s = this.ej(a, 0, a.length)
        return s == null ? a : s
    },
    ej(a, b, c) {
        var s, r, q, p
        for (s = b, r = null; s < c; ++s) {
            switch (a[s]) {
                case "&":
                    q = "&amp;"
                    break
                case '"':
                    q = "&quot;"
                    break
                case "'":
                    q = "&#39;"
                    break
                case "<":
                    q = "&lt;"
                    break
                case ">":
                    q = "&gt;"
                    break
                case "/":
                    q = "&#47;"
                    break
                default:
                    q = null
            }
            if (q != null) {
                if (r == null) r = new P.cH("")
                if (s > b) r.a += C.String.af(a, b, s)
                r.a += q
                b = s + 1
            }
        }
        if (r == null) return null
        if (c > b) r.a += J.rA(a, b, c)
        p = r.a
        return p.charCodeAt(0) == 0 ? p : p
    }
}
P.jI.prototype = {
    bt(a, b) {
        var s = P.uy(b, this.geP().a)
        return s
    },
    geP() {
        return C.L
    }
}
P.jJ.prototype = {}
P.kj.prototype = {
    bt(a, b) {
        return C.T_kk.ab(b)
    },
    gaB() {
        return C.E
    }
}
P.kn.prototype = {
    ab(a) {
        var s, r, q, p = P.cE(0, null, a.length),
            o = p - 0
        if (o === 0) return new Uint8Array(0)
        s = o * 3
        r = new Uint8Array(s)
        q = new P.lc(r)
        if (q.eo(a, 0, p) !== p) {
            J.ny(a, p - 1)
            q.ce()
        }
        return new Uint8Array(r.subarray(0, H.ug(0, q.b, s)))
    }
}
P.lc.prototype = {
    ce() {
        var s = this,
            r = s.c,
            q = s.b,
            p = s.b = q + 1
        r[q] = 239
        q = s.b = p + 1
        r[p] = 191
        s.b = q + 1
        r[q] = 189
    },
    eD(a, b) {
        var s, r, q, p, o = this
        if ((b & 64512) === 56320) {
            s = 65536 + ((a & 1023) << 10) | b & 1023
            r = o.c
            q = o.b
            p = o.b = q + 1
            r[q] = s >>> 18 | 240
            q = o.b = p + 1
            r[p] = s >>> 12 & 63 | 128
            p = o.b = q + 1
            r[q] = s >>> 6 & 63 | 128
            o.b = p + 1
            r[p] = s & 63 | 128
            return true
        } else {
            o.ce()
            return false
        }
    },
    eo(a, b, c) {
        var s, r, q, p, o, n, m, l = this
        if (b !== c && (C.String.aQ(a, c - 1) & 64512) === 55296) --c
        for (s = l.c, r = s.length, q = b; q < c; ++q) {
            p = C.String.a8(a, q)
            if (p <= 127) {
                o = l.b
                if (o >= r) break
                l.b = o + 1
                s[o] = p
            } else {
                o = p & 64512
                if (o === 55296) {
                    if (l.b + 4 > r) break
                    n = q + 1
                    if (l.eD(p, C.String.a8(a, n))) q = n
                } else if (o === 56320) {
                    if (l.b + 3 > r) break
                    l.ce()
                } else if (p <= 2047) {
                    o = l.b
                    m = o + 1
                    if (m >= r) break
                    l.b = m
                    s[o] = p >>> 6 | 192
                    l.b = m + 1
                    s[m] = p & 63 | 128
                } else {
                    o = l.b
                    if (o + 2 >= r) break
                    m = l.b = o + 1
                    s[o] = p >>> 12 | 224
                    o = l.b = m + 1
                    s[m] = p >>> 6 & 63 | 128
                    l.b = o + 1
                    s[o] = p & 63 | 128
                }
            }
        }
        return q
    }
}
P.kk.prototype = {
    ab(a) {
        var s = this.a,
            r = P.tL(s, a, 0, null)
        if (r != null) return r
        return new P.lb(s).eK(a, 0, null, true)
    }
}
P.lb.prototype = {
    eK(a, b, c, d) {
        var s, r, q, p, o = this,
            n = P.cE(b, c, a.length)
        if (b === n) return ""
        s = P.ub(a, b, n)
        r = o.c3(s, 0, n - b, true)
        q = o.b
        if ((q & 1) !== 0) {
            p = P.uc(q)
            o.b = 0
            throw H.wrap_expression(P.FormatException(p, a, b + o.c))
        }
        return r
    },
    c3(a, b, c, d) {
        var s, r, q = this
        if (c - b > 1000) {
            s = C.JsInt.ag(b + c, 2)
            r = q.c3(a, b, s, false)
            if ((q.b & 1) !== 0) return r
            return r + q.c3(a, s, c, d)
        }
        return q.eO(a, b, c, d)
    },
    eO(a, b, c, d) {
        var s, r, q, p, o, n, m, l = this,
            k = 65533,
            j = l.b,
            i = l.c,
            h = new P.cH(""),
            g = b + 1,
            f = a[b]
        $label0$0: for (s = l.a; true;) {
            for (; true; g = p) {
                r = C.String.a8("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFFFFFFFFFFFFFFFFGGGGGGGGGGGGGGGGHHHHHHHHHHHHHHHHHHHHHHHHHHHIHHHJEEBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBKCCCCCCCCCCCCDCLONNNMEEEEEEEEEEE", f) & 31
                i = j <= 32 ? f & 61694 >>> r : (f & 63 | i << 6) >>> 0
                j = C.String.a8(" \x000:XECCCCCN:lDb \x000:XECCCCCNvlDb \x000:XECCCCCN:lDb AAAAA\x00\x00\x00\x00\x00AAAAA00000AAAAA:::::AAAAAGG000AAAAA00KKKAAAAAG::::AAAAA:IIIIAAAAA000\x800AAAAA\x00\x00\x00\x00 AAAAA", j + r)
                if (j === 0) {
                    h.a += H.cC(i)
                    if (g === c) break $label0$0
                    break
                } else if ((j & 1) !== 0) {
                    if (s) switch (j) {
                        case 69:
                        case 67:
                            h.a += H.cC(k)
                            break
                        case 65:
                            h.a += H.cC(k);
                            --g
                            break
                        default:
                            q = h.a += H.cC(k)
                            h.a = q + H.cC(k)
                            break
                    } else {
                        l.b = j
                        l.c = g - 1
                        return ""
                    }
                    j = 0
                }
                if (g === c) break $label0$0
                p = g + 1
                f = a[g]
            }
            p = g + 1
            f = a[g]
            if (f < 128) {
                while (true) {
                    if (!(p < c)) {
                        o = c
                        break
                    }
                    n = p + 1
                    f = a[p]
                    if (f >= 128) {
                        o = n - 1
                        p = n
                        break
                    }
                    p = n
                }
                if (o - g < 20)
                    for (m = g; m < o; ++m) h.a += H.cC(a[m])
                else h.a += P.mh(a, g, o)
                if (o === c) break $label0$0
                g = p
            } else g = p
        }
        if (d && j > 32)
            if (s) h.a += H.cC(k)
            else {
                l.b = 77
                l.c = c
                return ""
            }
        l.b = j
        l.c = i
        s = h.a
        return s.charCodeAt(0) == 0 ? s : s
    }
}
P.dq.prototype = {
    aW(a, b) {
        if (b == null) return false
        return b instanceof P.dq && this.a === b.a && this.b === b.b
    },
    bg(a, b) {
        return C.JsInt.bg(this.a, b.a)
    },
    gak(a) {
        var s = this.a
        return (s ^ C.JsInt.am(s, 30)) & 1073741823
    },
    k(a) {
        var s = this,
            r = P.rN(H.tj(s)),
            q = P.fk(H.th(s)),
            p = P.fk(H.td(s)),
            o = P.fk(H.te(s)),
            n = P.fk(H.tg(s)),
            m = P.fk(H.ti(s)),
            l = P.rO(H.tf(s))
        if (s.b) return r + "-" + q + "-" + p + " " + o + ":" + n + ":" + m + "." + l + "Z"
        else return r + "-" + q + "-" + p + " " + o + ":" + n + ":" + m + "." + l
    }
}
P.Duration.prototype = {
    aW(a, b) {
        if (b == null) return false
        return b instanceof P.Duration && this.a === b.a
    },
    gak(a) {
        return C.JsInt.gak(this.a)
    },
    bg(a, b) {
        return C.JsInt.bg(this.a, b.a)
    },
    k(a) {
        var s, r, q, p = new P.Duration_toString_twoDigits(),
            o = this.a
        if (o < 0) return "-" + new P.Duration(0 - o).k(0)
        s = p.$1(C.JsInt.ag(o, 6e7) % 60)
        r = p.$1(C.JsInt.ag(o, 1e6) % 60)
        q = new P.Duration_toString_sixDigits().$1(o % 1e6)
        return "" + C.JsInt.ag(o, 36e8) + ":" + H.as_string(s) + ":" + H.as_string(r) + "." + H.as_string(q)
    }
}
P.Duration_toString_sixDigits.prototype = {
    $1(a) {
        if (a >= 1e5) return "" + a
        if (a >= 1e4) return "0" + a
        if (a >= 1000) return "00" + a
        if (a >= 100) return "000" + a
        if (a >= 10) return "0000" + a
        return "00000" + a
    },
    $S: 12
}
P.Duration_toString_twoDigits.prototype = {
    $1(a) {
        if (a >= 10) return "" + a
        return "0" + a
    },
    $S: 12
}
P.O.prototype = {
    gbz() {
        return H.getTraceFromException(this.$thrownJsError)
    }
}
P.f2.prototype = {
    k(a) {
        var s = this.a
        if (s != null) return "Assertion failed: " + P.jh(s)
        return "Assertion failed"
    }
}
P.bc.prototype = {}
P.fL.prototype = {
    k(a) {
        return "Throw of null."
    }
}
P.aS.prototype = {
    gc7() {
        return "Invalid argument" + (!this.a ? "(s)" : "")
    },
    gc6() {
        return ""
    },
    k(a) {
        var s, r, q = this,
            p = q.c,
            o = p == null ? "" : " (" + p + ")",
            n = q.d,
            m = n == null ? "" : ": " + n,
            l = q.gc7() + o + m
        if (!q.a) return l
        s = q.gc6()
        r = P.jh(q.b)
        return l + s + ": " + r
    }
}
P.cD.prototype = {
    gc7() {
        return "RangeError"
    },
    gc6() {
        var s, r = this.e,
            q = this.f
        if (r == null) s = q != null ? ": Not less than or equal to " + H.as_string(q) : ""
        else if (q == null) s = ": Not greater than or equal to " + H.as_string(r)
        else if (q > r) s = ": Not in inclusive range " + H.as_string(r) + ".." + H.as_string(q)
        else s = q < r ? ": Valid value range is empty" : ": Only valid value is " + H.as_string(r)
        return s
    }
}
P.fs.prototype = {
    gc7() {
        return "RangeError"
    },
    gc6() {
        if (this.b < 0) return ": index must not be negative"
        var s = this.f
        if (s === 0) return ": no indices are valid"
        return ": index should be less than " + H.as_string(s)
    },
    gp(a) {
        return this.f
    }
}
P.hW.prototype = {
    k(a) {
        return "Unsupported operation: " + this.a
    }
}
P.hS.prototype = {
    k(a) {
        var s = this.a
        return s != null ? "UnimplementedError: " + s : "UnimplementedError"
    }
}
P.bJ.prototype = {
    k(a) {
        return "Bad state: " + this.a
    }
}
P.fh.prototype = {
    k(a) {
        var s = this.a
        if (s == null) return "Concurrent modification during iteration."
        return "Concurrent modification during iteration: " + P.jh(s) + "."
    }
}
P.fM.prototype = {
    k(a) {
        return "Out of Memory"
    },
    gbz() {
        return null
    },
    $iO: 1
}
P.el.prototype = {
    k(a) {
        return "Stack Overflow"
    },
    gbz() {
        return null
    },
    $iO: 1
}
P.fj.prototype = {
    k(a) {
        var s = this.a
        return s == null ? "Reading static variable during its initialization" : "Reading static variable '" + s + "' during its initialization"
    }
}
P.kG.prototype = {
    k(a) {
        return "Exception: " + this.a
    }
}
P.jm.prototype = {
    k(a) {
        var s, r, q, p, o, n, m, l, k, j, i, h, g = this.a,
            f = g != null && "" !== g ? "FormatException: " + H.as_string(g) : "FormatException",
            e = this.c,
            d = this.b
        if (typeof d == "string") {
            if (e != null) s = e < 0 || e > d.length
            else s = false
            if (s) e = null
            if (e == null) {
                if (d.length > 78) d = C.String.af(d, 0, 75) + "..."
                return f + "\n" + d
            }
            for (r = 1, q = 0, p = false, o = 0; o < e; ++o) {
                n = C.String.a8(d, o)
                if (n === 10) {
                    if (q !== o || !p) ++r
                    q = o + 1
                    p = false
                } else if (n === 13) {
                    ++r
                    q = o + 1
                    p = true
                }
            }
            f = r > 1 ? f + (" (at line " + r + ", character " + (e - q + 1) + ")\n") : f + (" (at character " + (e + 1) + ")\n")
            m = d.length
            for (o = e; o < m; ++o) {
                n = C.String.aQ(d, o)
                if (n === 10 || n === 13) {
                    m = o
                    break
                }
            }
            if (m - q > 78)
                if (e - q < 75) {
                    l = q + 75
                    k = q
                    j = ""
                    i = "..."
                } else {
                    if (m - e < 75) {
                        k = m - 75
                        l = m
                        i = ""
                    } else {
                        k = e - 36
                        l = e + 36
                        i = "..."
                    }
                    j = "..."
                }
            else {
                l = m
                k = q
                j = ""
                i = ""
            }
            h = C.String.af(d, k, l)
            return f + j + h + i + "\n" + C.String.cG(" ", e - k + j.length) + "^\n"
        } else return e != null ? f + (" (at offset " + H.as_string(e) + ")") : f
    }
}
P.L.prototype = {
    bV(a, b) {
        return new H.cf(this, b, H._instanceType(this).i("cf<L.E>"))
    },
    gp(a) {
        var s, r = this.ga0(this)
        for (s = 0; r.u();) ++s
        return s
    },
    gbv(a) {
        return !this.ga0(this).u()
    },
    gba(a) {
        var s, r = this.ga0(this)
        if (!r.u()) throw H.wrap_expression(H.fu())
        s = r.gC()
        if (r.u()) throw H.wrap_expression(H.rY())
        return s
    },
    ai(a, b) {
        var s, r, q
        P.to(b, "index")
        for (s = this.ga0(this), r = 0; s.u();) {
            q = s.gC()
            if (b === r) return q;
            ++r
        }
        throw H.wrap_expression(P.ft(b, this, "index", null, r))
    },
    k(a) {
        return P.rX(this, "(", ")")
    }
}
P.fv.prototype = {}
P.N.prototype = {
    gak(a) {
        return P.Object.prototype.gak.call(this, this)
    },
    k(a) {
        return "null"
    }
}
P.Object.prototype = {
    $iH: 1,
    aW(a, b) {
        return this === b
    },
    gak(a) {
        return H.Primitives_objectHashCode(this)
    },
    k(a) {
        return "Instance of '" + H.as_string(H.jZ(this)) + "'"
    },
    gcw(a) {
        var s = this instanceof H.c_ ? H.closureFunctionType(this) : null
        return H.mz(s == null ? H.instanceType(this) : s)
    },
    toString() {
        return this.k(this)
    }
}
P.iq.prototype = {
    k(a) {
        return ""
    },
    $iba: 1
}
P.cH.prototype = {
    gp(a) {
        return this.a.length
    },
    k(a) {
        var s = this.a
        return s.charCodeAt(0) == 0 ? s : s
    }
}
W.HtmlElement.prototype = {}
W.AnchorElement.prototype = {
    k(a) {
        return String(a)
    }
}
W.AreaElement.prototype = {
    k(a) {
        return String(a)
    }
}
W.BaseElement.prototype = {
    $icn: 1
}
W.Blob.prototype = {
    $ibX: 1
}
W.BodyElement.prototype = {
    $ibY: 1
}
W.CanvasElement.prototype = {
    geJ(a) {
        return a.getContext("2d")
    }
}
W.CanvasRenderingContext2D.prototype = {
    eN(a, b, c) {
        var s = P.my(a.createImageData(b, c))
        return s
    },
    eR(a, b, c, d, e) {
        return a.fillRect(b, c, d, e)
    },
    dw(a, b, c, d) {
        a.putImageData(P.uO(b), c, d)
        return
    },
    fv(a) {
        return a.resetTransform()
    },
    fO(a, b, c, d, e, f, g) {
        return a.transform(b, c, d, e, f, g)
    },
    eQ(a, b, c, d) {
        return a.drawImage(b, c, d)
    }
}
W.b6.prototype = {
    gp(a) {
        return a.length
    }
}
W.co.prototype = {
    cU(a, b) {
        var s = $.oQ(),
            r = s[b]
        if (typeof r == "string") return r
        r = this.eC(a, b)
        s[b] = r
        return r
    },
    eC(a, b) {
        var s
        if (b.replace(/^-ms-/, "ms-").replace(/-([\da-z])/ig, function (c, d) {
            return d.toUpperCase()
        }) in a) return b
        s = $.oT() + b
        if (s in a) return s
        return b
    },
    d4(a, b, c, d) {
        a.setProperty(b, c, d)
    },
    gp(a) {
        return a.length
    }
}
W.j8.prototype = {}
W.dm.prototype = {
    $idm: 1
}
W.c0.prototype = {
    $ic0: 1
}
W.ja.prototype = {
    k(a) {
        return String(a)
    }
}
W.jb.prototype = {
    gp(a) {
        return a.length
    }
}
W.Element.prototype = {
    geH(a) {
        return new W.i8(a)
    },
    k(a) {
        return a.localName
    },
    bk(a, b, c, d, e) {
        var s, r = this.aA(a, c, d, e)
        switch (b.toLowerCase()) {
            case "beforebegin":
                a.parentNode.insertBefore(r, a)
                break
            case "afterbegin":
                s = a.childNodes
                a.insertBefore(r, s.length > 0 ? s[0] : null)
                break
            case "beforeend":
                a.appendChild(r)
                break
            case "afterend":
                s = a.parentNode
                s.toString
                s.insertBefore(r, a.nextSibling)
                break
            default:
                H.throw_expression(P.bz("Invalid position " + b, null))
        }
    },
    aA(a, b, c, d) {
        var s, r, q, p
        if (c == null) {
            if (d == null) {
                s = $.nJ
                if (s == null) {
                    s = H.b([], t.x)
                    r = new W.dN(s)
                    s.push(W.oc(null))
                    s.push(W.oh())
                    $.nJ = r
                    d = r
                } else d = s
            }
            s = $.nI
            if (s == null) {
                s = new W.ix(d)
                $.nI = s
                c = s
            } else {
                s.a = d
                c = s
            }
        } else if (d != null) throw H.wrap_expression(P.bz("validator can only be passed if treeSanitizer is null", null))
        if ($.bA == null) {
            s = document
            r = s.implementation.createHTMLDocument("")
            $.bA = r
            $.m4 = r.createRange()
            r = $.bA.createElement("base")
            t.cR.a(r)
            s = s.baseURI
            s.toString
            r.href = s
            $.bA.head.appendChild(r)
        }
        s = $.bA
        if (s.body == null) {
            r = s.createElement("body")
            s.body = t.b.a(r)
        }
        s = $.bA
        if (t.b.b(a)) {
            s = s.body
            s.toString
            q = s
        } else {
            s.toString
            q = s.createElement(a.tagName)
            $.bA.body.appendChild(q)
        }
        if ("createContextualFragment" in window.Range.prototype && !C.Array.w(C.O, a.tagName)) {
            $.m4.selectNodeContents(q)
            s = $.m4
            s.toString
            p = s.createContextualFragment(b == null ? "null" : b)
        } else {
            q.innerHTML = b
            p = $.bA.createDocumentFragment()
            for (; s = q.firstChild, s != null;) p.appendChild(s)
        }
        if (q !== $.bA.body) J.nA(q)
        c.cH(p)
        document.adoptNode(p)
        return p
    },
    eM(a, b, c) {
        return this.aA(a, b, c, null)
    },
    by(a, b, c) {
        a.textContent = null
        a.appendChild(this.aA(a, b, null, c))
    },
    cJ(a, b) {
        return this.by(a, b, null)
    },
    gdD(a) {
        return a.tagName
    },
    $iQ: 1
}
W.jf.prototype = {
    $1(a) {
        return t.R.b(a)
    },
    $S: 47
}
W.o.prototype = {
    $io: 1
}
W.fn.prototype = {
    eF(receiver, type, listener, options) {
        if (listener != null) {
            this.add_event_listener(receiver, type, listener, false)
        }
    },
    add_event_listener(receiver, type, listener, options) {
        // console.log("md5.js add event listener type:", type, "receiver:", receiver, "listener:", listener, options)
        // console.log("receiver == window", receiver == window)
        // var stack = new Error().stack
        // console.log(stack)
        receiver.addEventListener(type, H.convert_dart_closure_to_js_md5(listener, 1), false)
        // return receiver.addEventListener(type, listener, false)
    }
}
W.cq.prototype = {
    $icq: 1
}
W.fp.prototype = {
    gp(a) {
        return a.length
    }
}
W.c4.prototype = {
    gck(a) {
        return a.data
    },
    $ic4: 1
}
W.jL.prototype = {
    k(a) {
        return String(a)
    }
}
W.c8.prototype = {
    $ic8: 1
}
W.dH.prototype = {
    $idH: 1
}
W.bp.prototype = {
    $ibp: 1
}
W.az.prototype = {
    gba(a) {
        var s = this.a,
            r = s.childNodes.length
        if (r === 0) throw H.wrap_expression(P.cd("No elements"))
        if (r > 1) throw H.wrap_expression(P.cd("More than one element"))
        s = s.firstChild
        s.toString
        return s
    },
    a5(a, b) {
        var s, r, q, p = b.a,
            o = this.a
        if (p !== o)
            for (s = p.childNodes.length, r = 0; r < s; ++r) {
                q = p.firstChild
                q.toString
                o.appendChild(q)
            }
        return
    },
    m(a, b, c) {
        var s = this.a
        s.replaceChild(c, s.childNodes[b])
    },
    ga0(a) {
        var s = this.a.childNodes
        return new W.dv(s, s.length)
    },
    gp(a) {
        return this.a.childNodes.length
    },
    sp(a, b) {
        throw H.wrap_expression(P.UnsupportError("Cannot set length on immutable List."))
    },
    h(a, b) {
        return this.a.childNodes[b]
    }
}
W.v.prototype = {
    fq(a) {
        var s = a.parentNode
        if (s != null) s.removeChild(a)
    },
    k(a) {
        var s = a.nodeValue
        return s == null ? this.dO(a) : s
    },
    $iv: 1
}
W.dM.prototype = {
    gp(a) {
        return a.length
    },
    h(a, b) {
        if (b >>> 0 !== b || b >= a.length) throw H.wrap_expression(P.ft(b, a, null, null, null))
        return a[b]
    },
    m(a, b, c) {
        throw H.wrap_expression(P.UnsupportError("Cannot assign element of immutable List."))
    },
    sp(a, b) {
        throw H.wrap_expression(P.UnsupportError("Cannot resize immutable List."))
    },
    ai(a, b) {
        return a[b]
    },
    $iA: 1,
    $iag: 1,
    $iw: 1
}
W.dQ.prototype = {}
W.h4.prototype = {
    gp(a) {
        return a.length
    }
}
W.ek.prototype = {}
W.hN.prototype = {
    h(a, b) {
        return a.getItem(H.lg(b))
    },
    aw(a, b) {
        var s, r, q
        for (s = 0; true; ++s) {
            r = a.key(s)
            if (r == null) return
            q = a.getItem(r)
            q.toString
            b.$2(r, q)
        }
    },
    gad(a) {
        var s = H.b([], t.s)
        this.aw(a, new W.kd(s))
        return s
    },
    gp(a) {
        return a.length
    },
    $ibo: 1
}
W.kd.prototype = {
    $2(a, b) {
        return this.a.push(a)
    },
    $S: 41
}
W.bb.prototype = {
    $ibb: 1
}
W.ce.prototype = {}
W.en.prototype = {
    aA(a, b, c, d) {
        var s, r
        if ("createContextualFragment" in window.Range.prototype) return this.bY(a, b, c, d)
        s = W.rP("<table>" + H.as_string(b) + "</table>", c, d)
        r = document.createDocumentFragment()
        r.toString
        s.toString
        new W.az(r).a5(0, new W.az(s))
        return r
    }
}
W.hQ.prototype = {
    aA(a, b, c, d) {
        var s, r, q, p
        if ("createContextualFragment" in window.Range.prototype) return this.bY(a, b, c, d)
        s = document
        r = s.createDocumentFragment()
        s = C.u.aA(s.createElement("table"), b, c, d)
        s.toString
        s = new W.az(s)
        q = s.gba(s)
        q.toString
        s = new W.az(q)
        p = s.gba(s)
        r.toString
        p.toString
        new W.az(r).a5(0, new W.az(p))
        return r
    }
}
W.hR.prototype = {
    aA(a, b, c, d) {
        var s, r, q
        if ("createContextualFragment" in window.Range.prototype) return this.bY(a, b, c, d)
        s = document
        r = s.createDocumentFragment()
        s = C.u.aA(s.createElement("table"), b, c, d)
        s.toString
        s = new W.az(s)
        q = s.gba(s)
        r.toString
        q.toString
        new W.az(r).a5(0, new W.az(q))
        return r
    }
}
W.cI.prototype = {
    $icI: 1
}
W.aY.prototype = {}
W.eq.prototype = {
    fg(a, b, c) {
        var s = W.oa(a.open(b, c))
        return s
    },
    dt(a, b, c) {
        a.postMessage(new P._StructuredCloneDart2Js([], []).aO(b), c)
        return
    }
}
W.cL.prototype = {
    $icL: 1
}
W.ex.prototype = {
    gp(a) {
        return a.length
    },
    h(a, b) {
        if (b >>> 0 !== b || b >= a.length) throw H.wrap_expression(P.ft(b, a, null, null, null))
        return a[b]
    },
    m(a, b, c) {
        throw H.wrap_expression(P.UnsupportError("Cannot assign element of immutable List."))
    },
    sp(a, b) {
        throw H.wrap_expression(P.UnsupportError("Cannot resize immutable List."))
    },
    ai(a, b) {
        return a[b]
    },
    $iA: 1,
    $iag: 1,
    $iw: 1
}
W.eH.prototype = {
    gp(a) {
        return a.length
    },
    h(a, b) {
        if (b >>> 0 !== b || b >= a.length) throw H.wrap_expression(P.ft(b, a, null, null, null))
        return a[b]
    },
    m(a, b, c) {
        throw H.wrap_expression(P.UnsupportError("Cannot assign element of immutable List."))
    },
    sp(a, b) {
        throw H.wrap_expression(P.UnsupportError("Cannot resize immutable List."))
    },
    gbl(a) {
        var s = a.length
        if (s > 0) return a[s - 1]
        throw H.wrap_expression(P.cd("No elements"))
    },
    ai(a, b) {
        return a[b]
    },
    $iA: 1,
    $iag: 1,
    $iw: 1
}
W.i2.prototype = {
    aw(a, b) {
        var s, r, q, p, o
        for (s = this.gad(this), r = s.length, q = this.a, p = 0; p < s.length; s.length === r || (0, H.F)(s), ++p) {
            o = s[p]
            b.$2(o, q.getAttribute(o))
        }
    },
    gad(a) {
        var s, r, q, p, o, n, m = this.a.attributes
        m.toString
        s = H.b([], t.s)
        for (r = m.length, q = t.h9, p = 0; p < r; ++p) {
            o = q.a(m[p])
            if (o.namespaceURI == null) {
                n = o.name
                n.toString
                s.push(n)
            }
        }
        return s
    }
}
W.i8.prototype = {
    h(a, b) {
        return this.a.getAttribute(H.lg(b))
    },
    gp(a) {
        return this.gad(this).length
    }
}
W.m5.prototype = {}
W.ia.prototype = {}
W.kF.prototype = {
    $1(a) {
        return this.a.$1(a)
    },
    $S: 39
}
W.cP.prototype = {
    e6(a) {
        var s
        if ($.et.gbv($.et)) {
            for (s = 0; s < 262; ++s) $.et.m(0, C.M[s], W.uV())
            for (s = 0; s < 12; ++s) $.et.m(0, C.l[s], W.uW())
        }
    },
    b_(a) {
        return $.rl().w(0, W.ds(a))
    },
    aM(a, b, c) {
        var s = $.et.h(0, H.as_string(W.ds(a)) + "::" + b)
        if (s == null) s = $.et.h(0, "*::" + b)
        if (s == null) return false
        return s.$4(a, b, c, this)
    },
    $iaN: 1
}
W.cr.prototype = {
    ga0(a) {
        return new W.dv(a, this.gp(a))
    }
}
W.dN.prototype = {
    b_(a) {
        return C.Array.df(this.a, new W.jP(a))
    },
    aM(a, b, c) {
        return C.Array.df(this.a, new W.jO(a, b, c))
    },
    $iaN: 1
}
W.jP.prototype = {
    $1(a) {
        return a.b_(this.a)
    },
    $S: 13
}
W.jO.prototype = {
    $1(a) {
        return a.aM(this.a, this.b, this.c)
    },
    $S: 13
}
W.eD.prototype = {
    e7(a, b, c, d) {
        var s, r, q
        this.a.a5(0, c)
        s = b.bV(0, new W.l0())
        r = b.bV(0, new W.l1())
        this.b.a5(0, s)
        q = this.c
        q.a5(0, C.P)
        q.a5(0, r)
    },
    b_(a) {
        return this.a.w(0, W.ds(a))
    },
    aM(a, b, c) {
        var s = this,
            r = W.ds(a),
            q = s.c
        if (q.w(0, H.as_string(r) + "::" + b)) return s.d.eG(c)
        else if (q.w(0, "*::" + b)) return s.d.eG(c)
        else {
            q = s.b
            if (q.w(0, H.as_string(r) + "::" + b)) return true
            else if (q.w(0, "*::" + b)) return true
            else if (q.w(0, H.as_string(r) + "::*")) return true
            else if (q.w(0, "*::*")) return true
        }
        return false
    },
    $iaN: 1
}
W.l0.prototype = {
    $1(a) {
        return !C.Array.w(C.l, a)
    },
    $S: 14
}
W.l1.prototype = {
    $1(a) {
        return C.Array.w(C.l, a)
    },
    $S: 14
}
W.it.prototype = {
    aM(a, b, c) {
        if (this.dX(a, b, c)) return true
        if (b === "template" && c === "") return true
        if (a.getAttribute("template") === "") return this.e.w(0, b)
        return false
    }
}
W.l7.prototype = {
    $1(a) {
        return "TEMPLATE::" + H.as_string(a)
    },
    $S: 10
}
W.is.prototype = {
    b_(a) {
        var s
        if (t.ew.b(a)) return false
        s = t.g7.b(a)
        if (s && W.ds(a) === "foreignObject") return false
        if (s) return true
        return false
    },
    aM(a, b, c) {
        if (b === "is" || C.String.bA(b, "on")) return false
        return this.b_(a)
    },
    $iaN: 1
}
W.dv.prototype = {
    u() {
        var s = this,
            r = s.c + 1,
            q = s.b
        if (r < q) {
            // s.d = J.J(s.a, r)
            s.d = s.a[r]
            s.c = r
            return true
        }
        s.d = null
        s.c = q
        return false
    },
    gC() {
        return this.d
    }
}
W.kE.prototype = {
    dt(a, b, c) {
        this.a.postMessage(new P._StructuredCloneDart2Js([], []).aO(b), c)
    }
}
W.l_.prototype = {}
W.ix.prototype = {
    cH(a) {
        var s, r = new W.le(this)
        do {
            s = this.b
            r.$2(a, null)
        } while (s !== this.b)
    },
    br(a, b) {
        ++this.b
        if (b == null || b !== a.parentNode) J.nA(a)
        else b.removeChild(a)
    },
    ew(a, b) {
        var s, r, q, p, o, n = true,
            m = null,
            l = null
        try {
            m = J.rv(a)
            l = m.a.getAttribute("is")
            s = function (c) {
                if (!(c.attributes instanceof NamedNodeMap)) return true
                if (c.id == "lastChild" || c.name == "lastChild" || c.id == "previousSibling" || c.name == "previousSibling" || c.id == "children" || c.name == "children") return true
                var k = c.childNodes
                if (c.lastChild && c.lastChild !== k[k.length - 1]) return true
                if (c.children)
                    if (!(c.children instanceof HTMLCollection || c.children instanceof NodeList)) return true
                var j = 0
                if (c.children) j = c.children.length
                for (var i = 0; i < j; i++) {
                    var h = c.children[i]
                    if (h.id == "attributes" || h.name == "attributes" || h.id == "lastChild" || h.name == "lastChild" || h.id == "previousSibling" || h.name == "previousSibling" || h.id == "children" || h.name == "children") return true
                }
                return false
            }(a)
            n = s ? true : !(a.attributes instanceof NamedNodeMap)
        } catch (p) {
            H.unwrap_Exception(p)
        }
        r = "element unprintable"
        try {
            r = J.b4(a)
        } catch (p) {
            H.unwrap_Exception(p)
        }
        try {
            q = W.ds(a)
            this.ev(a, b, n, r, q, m, l)
        } catch (p) {
            if (H.unwrap_Exception(p) instanceof P.aS) throw p
            else {
                this.br(a, b)
                window
                o = "Removing corrupted element " + H.as_string(r)
                if (typeof console != "undefined") window.console.warn(o)
            }
        }
    },
    ev(a, b, c, d, e, f, g) {
        var s, r, q, p, o, n, m = this
        if (c) {
            m.br(a, b)
            window
            s = "Removing element due to corrupted attributes on <" + d + ">"
            if (typeof console != "undefined") window.console.warn(s)
            return
        }
        if (!m.a.b_(a)) {
            m.br(a, b)
            window
            s = "Removing disallowed element <" + H.as_string(e) + "> from " + H.as_string(b)
            if (typeof console != "undefined") window.console.warn(s)
            return
        }
        if (g != null)
            if (!m.a.aM(a, "is", g)) {
                m.br(a, b)
                window
                s = "Removing disallowed type extension <" + H.as_string(e) + ' is="' + g + '">'
                if (typeof console != "undefined") window.console.warn(s)
                return
            } s = f.gad(f)
        r = H.b(s.slice(0), H._arrayInstanceType(s))
        for (q = f.gad(f).length - 1, s = f.a; q >= 0; --q) {
            p = r[q]
            o = m.a
            n = J.rB(p)
            H.lg(p)
            if (!o.aM(a, n, s.getAttribute(p))) {
                window
                o = "Removing disallowed attribute <" + H.as_string(e) + " " + p + '="' + H.as_string(s.getAttribute(p)) + '">'
                if (typeof console != "undefined") window.console.warn(o)
                s.removeAttribute(p)
            }
        }
        if (t.aW.b(a)) {
            s = a.content
            s.toString
            m.cH(s)
        }
    }
}
W.le.prototype = {
    $2(a, b) {
        var s, r, q, p, o, n = this.a
        switch (a.nodeType) {
            case 1:
                n.ew(a, b)
                break
            case 8:
            case 11:
            case 3:
            case 4:
                break
            default:
                n.br(a, b)
        }
        s = a.lastChild
        for (; s != null;) {
            r = null
            try {
                r = s.previousSibling
                if (r != null) {
                    q = r.nextSibling
                    p = s
                    p = q == null ? p != null : q !== p
                    q = p
                } else q = false
                if (q) {
                    q = P.cd("Corrupt HTML")
                    throw H.wrap_expression(q)
                }
            } catch (o) {
                H.unwrap_Exception(o)
                q = s;
                ++n.b
                p = q.parentNode
                p = a == null ? p != null : a !== p
                if (p) {
                    p = q.parentNode
                    if (p != null) p.removeChild(q)
                } else a.removeChild(q)
                s = null
                r = a.lastChild
            }
            if (s != null) this.$2(s, a)
            s = r
        }
    },
    $S: 26
}
W.i6.prototype = {}
W.ig.prototype = {}
W.ih.prototype = {}
W.il.prototype = {}
W.iy.prototype = {}
W.iz.prototype = {}
W.iA.prototype = {}
W.iB.prototype = {}
P._StructuredClone.prototype = {
    bj(a) {
        var s, r = this.a,
            q = r.length
        for (s = 0; s < q; ++s)
            if (r[s] === a) return s
        r.push(a)
        this.b.push(null)
        return q
    },
    aO(a) {
        var s, r, q, p = this,
            o = {}
        if (a == null) return a
        if (H.lm(a)) return a
        if (typeof a == "number") return a
        if (typeof a == "string") return a
        if (a instanceof P.dq) return new Date(a.a)
        if (t.fv.b(a)) throw H.wrap_expression(P.hT("structured clone of RegExp"))
        if (t.c8.b(a)) return a
        if (t.fK.b(a)) return a
        if (t.I.b(a)) return a
        if (t.bZ.b(a) || t.dD.b(a) || t.bK.b(a)) return a
        if (t.eO.b(a)) {
            s = p.bj(a)
            r = p.b
            q = o.a = r[s]
            if (q != null) return q
            q = {}
            o.a = q
            r[s] = q
            J.lY(a, new P.l5(o, p))
            return o.a
        }
        if (t.aH.b(a)) {
            s = p.bj(a)
            q = p.b[s]
            if (q != null) return q
            return p.eL(a, s)
        }
        if (t.eH.b(a)) {
            s = p.bj(a)
            r = p.b
            q = o.b = r[s]
            if (q != null) return q
            q = {}
            o.b = q
            r[s] = q
            p.eY(a, new P.l6(o, p))
            return o.b
        }
        throw H.wrap_expression(P.hT("structured clone of other type"))
    },
    eL(a, b) {
        var s, r = J.a3(a),
            q = r.gp(a),
            p = new Array(q)
        this.b[b] = p
        for (s = 0; s < q; ++s) p[s] = this.aO(r.h(a, s))
        return p
    }
}
P.l5.prototype = {
    $2(a, b) {
        this.a.a[a] = this.b.aO(b)
    },
    $S: 24
}
P.l6.prototype = {
    $2(a, b) {
        this.a.b[a] = this.b.aO(b)
    },
    $S: 23
}
P.kw.prototype = {
    bj(a) {
        var s, r = this.a,
            q = r.length
        for (s = 0; s < q; ++s)
            if (r[s] === a) return s
        r.push(a)
        this.b.push(null)
        return q
    },
    aO(a) {
        var s, r, q, p, o, n, m, l, k, j = this,
            i = {}
        if (a == null) return a
        if (H.lm(a)) return a
        if (typeof a == "number") return a
        if (typeof a == "string") return a
        if (a instanceof Date) {
            s = a.getTime()
            if (Math.abs(s) <= 864e13) r = false
            else r = true
            if (r) H.throw_expression(P.bz("DateTime is outside valid range: " + s, null))
            H.ls(true, "isUtc", t.y)
            return new P.dq(s, true)
        }
        if (a instanceof RegExp) throw H.wrap_expression(P.hT("structured clone of RegExp"))
        if (typeof Promise != "undefined" && a instanceof Promise) return P.vf(a, t.z)
        q = Object.getPrototypeOf(a)
        if (q === Object.prototype || q === null) {
            p = j.bj(a)
            r = j.b
            o = i.a = r[p]
            if (o != null) return o
            n = t.z
            o = P.cu(n, n)
            i.a = o
            r[p] = o
            j.eX(a, new P.ky(i, j))
            return i.a
        }
        if (a instanceof Array) {
            m = a
            p = j.bj(m)
            r = j.b
            o = r[p]
            if (o != null) return o
            n = J.a3(m)
            l = n.gp(m)
            o = j.c ? new Array(l) : m
            r[p] = o
            for (r = J.cW(o), k = 0; k < l; ++k) r.m(o, k, j.aO(n.h(m, k)))
            return o
        }
        return a
    }
}
P.ky.prototype = {
    $2(a, b) {
        var s = this.a.a,
            r = this.b.aO(b)
        J.lT(s, a, r)
        return r
    },
    $S: 25
}
P.eJ.prototype = {
    $ic4: 1,
    gck(a) {
        return this.a
    }
}
P._StructuredCloneDart2Js.prototype = {
    eY(a, b) {
        var s, r, q, p
        for (s = Object.keys(a), r = s.length, q = 0; q < r; ++q) {
            p = s[q]
            b.$2(p, a[p])
        }
    }
}
P.kx.prototype = {
    eX(a, b) {
        var s, r, q, p
        for (s = Object.keys(a), r = s.length, q = 0; q < s.length; s.length === r || (0, H.F)(s), ++q) {
            p = s[q]
            b.$2(p, a[p])
        }
    }
}
P.jQ.prototype = {
    k(a) {
        return "Promise was rejected with a value of `" + (this.a ? "undefined" : "null") + "`."
    }
}
P.lE.prototype = {
    $1(a) {
        return this.a.bM(0, a)
    },
    $S: 5
}
P.lF.prototype = {
    $1(a) {
        if (a == null) return this.a.dg(new P.jQ(a === undefined))
        return this.a.dg(a)
    },
    $S: 5
}
P.kT.prototype = {
    ax(a) {
        if (a <= 0 || a > 4294967296) throw H.wrap_expression(P.tn("max must be in range 0 < max \u2264 2^32, was " + H.as_string(a)))
        return Math.random() * a >>> 0
    }
}
P.cF.prototype = {
    $icF: 1
}
P.p.prototype = {
    aA(a, b, c, d) {
        var s, r, q, p, o, n
        if (d == null) {
            s = H.b([], t.x)
            d = new W.dN(s)
            s.push(W.oc(null))
            s.push(W.oh())
            s.push(new W.is())
        }
        c = new W.ix(d)
        r = '<svg version="1.1">' + H.as_string(b) + "</svg>"
        s = document
        q = s.body
        q.toString
        p = C.BodyElement.eM(q, r, c)
        o = s.createDocumentFragment()
        p.toString
        s = new W.az(p)
        n = s.gba(s)
        for (; s = n.firstChild, s != null;) o.appendChild(s)
        return o
    },
    $ip: 1
}
Y.RC4.prototype = {
    bd(a, b) {
        // init
        var s, r, q, p, o, n, m, l = new Array(256)
        l.fixed$length = Array
        l = this.c = H.b(l, t.i)
        for (s = 0; s < 256; ++s) l[s] = s
        r = a.length
        for (q = 0; q < b; ++q)
            for (p = 0, o = 0; o < 256; ++o) {
                n = a[C.JsInt.V(o, r)]
                m = l[o]
                p = p + m + n & 255
                l[o] = l[p]
                l[p] = m
            }
        this.a = this.b = 0
    },
    bO(a) {
        var s, r, q, p, o, n = this,
            m = a.length
        for (s = 0; s < m; ++s) {
            r = n.a = n.a + 1 & 255
            q = n.b
            p = n.c
            o = p[r]
            q = n.b = q + o & 255
            p[r] = p[q]
            p[q] = o
            a[s] = (a[s] ^ p[p[r] + p[q] & 255]) >>> 0
            n.b = q + a[s] & 255
        }
    },
    di(a) {
        // init?
        var s, r, q, p, o, n, m = this,
            l = a.length
        for (s = 0; s < l; ++s) {
            r = m.a = m.a + 1 & 255
            q = m.b
            p = m.c
            o = p[r]
            q = m.b = q + o & 255
            p[r] = p[q]
            p[q] = o
            n = a[s]
            a[s] = (n ^ p[p[r] + p[q] & 255]) >>> 0
            m.b = q + n & 255
        }
    },
    n() {
        // next byte from ShadowR
        var _this = this,
            r = _this.a = _this.a + 1 & 255,
            q = _this.b,
            p = _this.c,
            o = p[r]
        q = _this.b = q + o & 255
        p[r] = p[q]
        p[q] = o
        return p[p[r] + p[q] & 255]
    }
}
L.ProfileWinChance.prototype = {
    gbu(a) {
        return null
    },
    dY(a, b) {
        var s, r, q, p, o, n, m, l, k = this
        for (s = k.a, r = s.length, q = k.e, p = k.r, o = 0; o < s.length; s.length === r || (0, H.F)(s), ++o) {
            n = s[o]
            m = J.a3(n)
            l = T.init_boss(m.h(n, 0), m.h(n, 1), null, m.h(n, 2))
            q.push(l)
            p.push(l.e)
        }
        for (s = k.b, r = s.length, p = k.f, o = 0; o < s.length; s.length === r || (0, H.F)(s), ++o) {
            n = s[o]
            m = J.a3(n)
            p.push(T.init_boss(m.h(n, 0), m.h(n, 1), null, m.h(n, 2)))
        }
        s = q.length
        if (s + p.length >>> 4 === 0) {
            for (o = 0; o < s; ++o) {
                l = q[o]
                l.I = l.gbT()
            }
            for (s = p.length, o = 0; o < s; ++o) {
                l = p[o]
                l.I = l.gbT()
            }
        }
    },
    O() {
        // 胜率评分
        logger.info("胜率输出 main")
        var async_goto = 0,
            async_completer = P._makeAsyncAwaitCompleter(t.d),
            some_q, this_ = this,
            o, n, m, l, k, j, i, h, g, f, e, d
        var $async$O = P._wrapJsFunctionForAsync(function (async_error_code, async_result) {
            if (async_error_code === 1) return P.async_rethrow(async_result, async_completer)
            while (true) switch (async_goto) {
                case 0:
                    d = this_.x
                    if (d.length !== 0) {
                        some_q = C.Array.cu(d, 0)
                        async_goto = 1
                        break
                    }
                    if (this_.z >= this_.c) {
                        some_q = null
                        async_goto = 1
                        break
                    }
                    o = this_.r, n = t.v, m = this_.a, l = this_.b, k = t.V, j = t.D, i = 0
                case 3:
                    if (!(i < 100)) {
                        async_goto = 4
                        break
                    }
                    h = H.b([m, l, [H.b([H.as_string($.ni()) + this_.d++, $.cl()], k)]], j)
                    if (this_.z === 0) h.pop()
                    async_goto = 5
                    return P._asyncAwait(T.inner_main(h), $async$O)
                case 5:
                    g = async_result
                    f = null
                case 6:
                    // if (!true) {
                    //     async_goto = 8
                    //     break
                    // }
                    async_goto = 9
                    return P._asyncAwait(g.O(), $async$O)
                case 9:
                    e = async_result
                    if (e == null) {
                        async_goto = 8
                        break
                    }
                case 7:
                    f = e
                    async_goto = 6
                    break
                case 8:
                    if (C.Array.w(o, n.a(f.a[0]).e.gb2())) ++this_.y;
                    ++i;
                    ++this_.z
                    async_goto = 3
                    break
                case 4:
                    o = t.U
                    n = H.b([], o)
                    m = t.Y
                    l = H.b([], m)
                    // 实力评估中...[2]%
                    // benchmarking
                    n.push(T.RunUpdate(LangData.get_lang("pkGN"), null, null, C.JsInt.ag(this_.z, 100), null, 0, 0, 0))
                    if (this_.z >= this_.c) {
                        o = H.b([], o)
                        m = H.b([], m)
                        // 》 胜率: [2]%
                        // benchmarkRatio
                        o.push(T.RunUpdate(LangData.get_lang("Pnrn"), null, null, this_.y * 100 / this_.c, null, 0, 1000, 100))
                        d.push(new T.aq(o, m))
                        this_.c *= 10
                    }
                    some_q = new T.aq(n, l)
                    async_goto = 1
                    break
                case 1:
                    return P.async_return(some_q, async_completer)
            }
        })
        // let stack = new Error().stack
        // console.log("L.iR.O", stack)

        return P._asyncStartSync($async$O, async_completer)
    },
    ae(a, b) {
        return this.dJ(0, b)
    },
    dJ(a, b) {
        var s = 0,
            r = P._makeAsyncAwaitCompleter(t.z),
            q = this,
            p, o, n, m, l
        var $async$ae = P._wrapJsFunctionForAsync(function (c, d) {
            if (c === 1) return P.async_rethrow(d, r)
            while (true) switch (s) {
                case 0:
                    q.Q = b
                    p = q.ch
                    p[0] = Date.now() + 1
                    o = q.e, n = o.length, m = 0
                case 2:
                    if (!(m < o.length)) {
                        s = 4
                        break
                    }
                    s = 5
                    return P._asyncAwait(o[m].az(), $async$ae)
                case 5:
                case 3:
                    o.length === n || (0, H.F)(o), ++m
                    s = 2
                    break
                case 4:
                    n = q.f, l = n.length, m = 0
                case 6:
                    if (!(m < n.length)) {
                        s = 8
                        break
                    }
                    s = 9
                    return P._asyncAwait(n[m].az(), $async$ae)
                case 9:
                case 7:
                    n.length === l || (0, H.F)(n), ++m
                    s = 6
                    break
                case 8:
                    o = new H.y(o, new L.iS(), H._arrayInstanceType(o).i("y<1,@>")).aV(0, "\r") + "\n" + new H.y(n, new L.iT(), H._arrayInstanceType(n).i("y<1,@>")).aV(0, "\r") + "\n"
                    o = C.e.gaB().ab(o)
                    n = H.instanceType(o).i("a9<z.E>")
                    l = n.i("y<M.E,l*>")
                    l = P.List_List_of(new H.y(new H.a9(o, n), new L.iU(q), l), true, l.i("M.E"))
                    C.Array.a5(l, H.fJ(p.buffer, 0, null))
                    A.eR(X.dc(l))
                    return P.async_return(null, r)
            }
        })
        return P._asyncStartSync($async$ae, r)
    }
}
L.iS.prototype = {
    $1(a) {
        return a.I.$0()
    },
    $S: 3
}
L.iT.prototype = {
    $1(a) {
        return a.I.$0()
    },
    $S: 3
}
L.iU.prototype = {
    $1(a) {
        return (a ^ this.a.Q) >>> 0
    },
    $S: 2
}
X.je.prototype = {
    $0() {
        var s, r = P.aL(93, 0, false, t.B)
        for (s = 0; s < 93; ++s) r[s] = C.String.a8(u.b, s)
        return r
    },
    $S: 21
}
X.j9.prototype = {
    $0() {
        var s, r = P.aL(128, 93, false, t.B)
        for (s = 0; s < 93; ++s) r[C.String.a8(u.b, s)] = s
        return r
    },
    $S: 21
}
V.ProfileMain.prototype = {
    gbu(a) {
        return null
    },
    dZ(a, b) {
        // 什么奇怪的算法?
        var s, r, q, p, o, n, m, this_ = this,
            k = this_.b
        // if (k.length === 2 && J.Y(J.J(k[0], 0), J.J(k[1], 0)) && J.Y(J.J(k[0], 1), J.J(k[1], 1))) {
        if (k.length === 2 && (k[0][0] == k[1][0]) && (k[0][1] == k[1][1])) {
            k.pop()
            this_.c = true
        }
        for (s = k.length, r = this_.f, q = this_.r, p = 0; p < k.length; k.length === s || (0, H.F)(k), ++p) {
            o = k[p]
            n = J.a3(o)
            m = T.init_boss(n.h(o, 0), n.h(o, 1), null, n.h(o, 2))
            r.push(m)
            q.push(m.e)
        }
        k = r.length
        if (k + 5 >>> 4 === 0)
            for (p = 0; p < k; ++p) {
                m = r[p]
                m.I = m.gbT()
            }
        if (q.length === 1) this_.x = q[0]
    },
    O() {
        // 实力评分 main
        // 普评? + 
        logger.debug("评分 输出")
        var async_goto = 0,
            async_completer = P._makeAsyncAwaitCompleter(t.d),
            q, this_ = this,
            o, n, m, l, k, j, i, h, g, f, get_result, d, c, b, a, a0, a1, a2, a3, a4
        var $async$O = P._wrapJsFunctionForAsync(function (async_error_code, async_result) {
            if (async_error_code === 1) return P.async_rethrow(async_result, async_completer)
            while (true) switch (async_goto) {
                case 0:
                    a4 = this_.y
                    if (a4.length !== 0) {
                        q = C.Array.cu(a4, 0)
                        async_goto = 1
                        break
                    }
                    if (this_.ch >= this_.d) {
                        q = null
                        async_goto = 1
                        break
                    }
                    a4 = this_.r, o = t.v, n = this_.z, m = this_.b, l = this_.a, k = t.V, j = t.D, i = 0
                case 3:
                    if (!(i < 100)) {
                        async_goto = 4
                        break
                    }
                    if (m.length === 1 && !this_.c) h = H.b([
                        [m[0], H.b(["" + this_.e++, l], k)],
                        [H.b(["" + this_.e++, l], k), H.b(["" + this_.e++, l], k)]
                    ], j)
                    else {
                        g = []
                        h = H.b([m, g], j)
                        for (f = 0; f < m.length; ++f) g.push(H.b(["" + this_.e++, l], k))
                    }
                    async_goto = 5
                    return P._asyncAwait(T.inner_main(h), $async$O)
                case 5:
                    get_result = async_result
                    d = null
                case 6:
                    // if (!true) {
                    //     async_goto = 8
                    //     break
                    // }
                    async_goto = 9
                    return P._asyncAwait(get_result.O(), $async$O)
                case 9:
                    c = async_result
                    if (c == null) {
                        async_goto = 8
                        break
                    }
                    for (b = c.a, a = b.length, a0 = 0; a0 < b.length; b.length === a || (0, H.F)(b), ++a0) {
                        a1 = b[a0]
                        if (a1.a > 0) {
                            a2 = a1.e
                            a2 = a2 != null && a2.gb2() == this_.x
                        } else a2 = false
                        if (a2) {
                            a3 = a1.d
                            if (C.String.bA(a3, "[0]"))
                                if (n.J(0, a3)) n.m(0, a3, n.h(0, a3) + 1)
                                else n.m(0, a3, 1)
                        }
                    }
                case 7:
                    d = c
                    async_goto = 6
                    break
                case 8:
                    if (C.Array.w(a4, o.a(d.a[0]).e.gb2())) ++this_.Q;
                    ++i;
                    ++this_.ch
                    async_goto = 3
                    break
                case 4:
                    a4 = H.b([], t.U)
                    o = H.b([], t.Y)
                    // 实力评估中...[2]%
                    // benchmarking
                    a4.push(T.RunUpdate(LangData.get_lang("pkGN"), null, null, C.JsInt.ag(this_.ch, 100), null, 0, 0, 0))
                    if (this_.ch >= this_.d) {
                        this_.eS()
                    }
                    q = new T.aq(a4, o)
                    async_goto = 1
                    break
                case 1:
                    return P.async_return(q, async_completer)
            }
        })
        return P._asyncStartSync($async$O, async_completer)
    },
    // 实力评分 输出
    eS() {
        var s, this_ = this,
            q = H.b([], t.U),
            p = H.b([], t.Y)
        // 》 实力评分: [2]
        // benchmarkScore
        q.push(T.RunUpdate(LangData.get_lang("JkWn"), null, null, this_.Q * 1e4 / this_.d, null, 0, 1000, 100))
        this_.y.push(new T.aq(q, p))
        if (this_.x != null) {
            s = new T.NPlr()
            s.a = this_.f[0].e
            this_.z.aw(0, new V.j_(this_, s))
        }
        // console.log("iV.e5 this.d", this.d)
        // this.d => 下一个目标
        this_.d *= 10
        // console.log("iV.e5 this.d", this.d)
    },
    ae(a, b) {
        return this.dK(0, b)
    },
    dK(a, b) {
        var async_goto = 0,
            async_completer = P._makeAsyncAwaitCompleter(t.z),
            q = this,
            p, o, n, m, l
        var $async$ae = P._wrapJsFunctionForAsync(function (c, d) {
            if (c === 1) return P.async_rethrow(d, async_completer)
            while (true) switch (async_goto) {
                case 0:
                    q.cx = b
                    p = q.cy
                    p[0] = Date.now() + 1
                    o = q.f, n = o.length, m = 0
                case 2:
                    if (!(m < o.length)) {
                        async_goto = 4
                        break
                    }
                    async_goto = 5
                    return P._asyncAwait(o[m].az(), $async$ae)
                case 5:
                case 3:
                    o.length === n || (0, H.F)(o), ++m
                    async_goto = 2
                    break
                case 4:
                    o = new H.y(o, new V.j0(), H._arrayInstanceType(o).i("y<1,@>")).aV(0, "\r") + "\n"
                    o = C.e.gaB().ab(o)
                    n = H.instanceType(o).i("a9<z.E>")
                    l = n.i("y<M.E,l*>")
                    l = P.List_List_of(new H.y(new H.a9(o, n), new V.j1(q), l), true, l.i("M.E"))
                    C.Array.a5(l, H.fJ(p.buffer, 0, null))
                    A.eR(X.dc(l))
                    return P.async_return(null, async_completer)
            }
        })
        return P._asyncStartSync($async$ae, async_completer)
    }
}
V.j_.prototype = {
    // 频率 输出
    $2(a, b) {
        var s, r, get_quote, p, o = null,
            n = this.a
        if (b / n.d > 0.005) {
            s = H.b([], t.U)
            r = H.b([], t.Y)
            get_quote = $.iK()
            // $.iK = ??
            // J.lW
            if (J.lW(a, $.ne())) {
                get_quote = "0"
            }
            p = this.b
            s.push(T.RunUpdate(a, p, o, get_quote, o, 0, 1000, 100))
            // 频率: [2]%
            // benchmarkSkill
            s.push(T.RunUpdate(LangData.get_lang("GJgn"), p, o, b * 100 / n.d, o, 0, 1000, 100))
            n.y.push(new T.aq(s, r))
            // console.log("benchmark", a, b, n.d, s)
            let stack = new Error().stack
            // console.log(stack)
        }
    },
    $S: 29
}
V.j0.prototype = {
    $1(a) {
        return a.I.$0()
    },
    $S: 3
}
V.j1.prototype = {
    $1(a) {
        return (a ^ this.a.cx) >>> 0
    },
    $S: 2
}
X.ProfileFind.prototype = {
    gbu(a) {
        return null
    },
    e_(a) {
        var s, r, q, p, o, n, m, l, k, j, i, h, g
        for (s = a.length, r = this.a, q = 0; q < a.length; a.length === s || (0, H.F)(a), ++q) {
            p = a[q]
            o = J.a3(p)
            n = $.rn().eU(o.h(p, 0))
            if (r.length === 0 && n != null) {
                m = n.b[0]
                s = m.length
                l = Math.pow(10, s)
                for (k = t.V, j = 0; j < l; ++j) {
                    i = o.h(p, 0)
                    h = C.String.fh(C.JsInt.k(j), s, "0")
                    i.toString
                    g = J.aw(i)
                    if (0 > g) H.throw_expression(P.a8(0, 0, g, "startIndex", null))
                    r.push(H.b([H.iG(i, m, h, 0), o.h(p, 1), o.h(p, 2)], k))
                }
                return
            } else r.push(p)
        }
    },
    O() {
        // 另一个评分主循环
        logger.debug("评分2 主循环")
        var async_goto = 0,
            async_completer = P._makeAsyncAwaitCompleter(t.d),
            q, this_ = this,
            o, n, m, l, k, j, i, h, g, f, e, d
        var $async$O = P._wrapJsFunctionForAsync(function (a, b) {
            if (a === 1) return P.async_rethrow(b, async_completer)
            while (true) switch (async_goto) {
                case 0:
                    e = this_.b
                    d = this_.a
                    if (e >= d.length) {
                        q = null
                        async_goto = 1
                        break
                    }
                    if (e < 0) {
                        this_.b = 0
                        e = H.b([], t.U)
                        o = H.b([], t.Y)
                        e.push($.K())
                        if (d.length >>> 13 > 0) {
                            e.push(T.RunUpdate(LangData.get_lang("BUaa"), null, null, null, null, 0, 1000, 100))
                            this_.b = d.length + 1
                        } else e.push(T.RunUpdate(LangData.get_lang("UZBn"), null, null, null, null, 0, 1000, 100))
                        q = new T.aq(e, o)
                        async_goto = 1
                        break
                    }
                    e = t.V, o = t.t, n = t.E
                case 3:
                    if (!(m = this_.b, m < d.length)) {
                        async_goto = 4
                        break
                    }
                    l = d[m]
                    this_.b = m + 1
                    k = H.b([H.b([l, H.b(["" + this_.c++, "\x02"], e)], o), H.b([H.b(["" + this_.c++, "\x02"], e), H.b(["" + this_.c++, "\x02"], e)], o)], n)
                    async_goto = 5
                    return P._asyncAwait(T.inner_main(k), $async$O)
                case 5:
                    j = b
                    i = C.Array.dl(j.c, new X.iX())
                    h = i.dE() + "\n"
                    g = i.Y
                case 6:
                    async_goto = 8
                    return P._asyncAwait(j.O(), $async$O)
                case 8:
                    if (!(b != null)) {
                        async_goto = 7
                        break
                    };
                    async_goto = 6
                    break
                case 7:
                    f = 0
                case 9:
                    if (!(f < 12)) {
                        async_goto = 11
                        break
                    }
                    async_goto = 12
                    return P._asyncAwait(T.inner_main(k), $async$O)
                case 12:
                    j = b
                case 13:
                    async_goto = 15
                    return P._asyncAwait(j.O(), $async$O)
                case 15:
                    if (!(b != null)) {
                        async_goto = 14
                        break
                    };
                    async_goto = 13
                    break
                case 14:
                case 10:
                    ++f
                    async_goto = 9
                    break
                case 11:
                    async_goto = g > 1200 ? 16 : 17
                    break
                case 16:
                    ++this_.e
                    async_goto = 18
                    // return P._asyncAwait(P.future_future_delayed(new P.Duration(1), t.z), $async$O)
                    // return P._asyncAwait(P.future_future_delayed(new P.Duration(1e6), t.z), $async$O)
                    break
                case 18:
                    e = this_.r
                    e[0] = Date.now() + 1
                    o = C.e.gaB().ab(h)
                    n = H.instanceType(o).i("a9<z.E>")
                    m = n.i("y<M.E,l*>")
                    m = P.List_List_of(new H.y(new H.a9(o, n), new X.iY(this_), m), true, m.i("M.E"))
                    e = e.buffer
                    e = new Uint8Array(e, 0)
                    C.Array.a5(m, e)
                    A.eR(X.dc(m))
                    async_goto = 4
                    break
                case 17:
                    async_goto = 3
                    break
                case 4:
                    e = H.b([], t.U)
                    o = H.b([], t.Y)
                    e.push($.K())
                    // 评分输出
                    if (run_env.from_code) {
                        console.log("outputing score")
                    }
                    if (this_.b >= d.length) {
                        e.push(T.RunUpdate(LangData.get_lang("tdaa"), null, null, null, null, 0, 1000, 100))
                        if (this_.e === 0) {
                            e.push(T.RunUpdate(LangData.get_lang("lIYA"), null, null, null, null, 0, 1000, 100))
                        }
                    }
                    q = new T.aq(e, o)
                    async_goto = 1
                    break
                case 1:
                    return P.async_return(q, async_completer)
            }
        })
        console.log("X.iW.O")
        return P._asyncStartSync($async$O, async_completer)
    },
    ae(a, b) {
        return this.dL(0, b)
    },
    dL(a, b) {
        var s = 0,
            r = P._makeAsyncAwaitCompleter(t.z),
            q = this,
            p, o, n, m
        var $async$ae = P._wrapJsFunctionForAsync(function (c, d) {
            if (c === 1) return P.async_rethrow(d, r)
            while (true) switch (s) {
                case 0:
                    q.f = b
                    p = q.r
                    p[0] = Date.now() + 1
                    o = C.e.gaB().ab("\t\t\t\t\n")
                    n = H.instanceType(o).i("a9<z.E>")
                    m = n.i("y<M.E,l*>")
                    m = P.List_List_of(new H.y(new H.a9(o, n), new X.iZ(q), m), true, m.i("M.E"))
                    C.Array.a5(m, H.fJ(p.buffer, 0, null))
                    A.eR(X.dc(m))
                    return P.async_return(null, r)
            }
        })
        return P._asyncStartSync($async$ae, r)
    }
}
X.iX.prototype = {
    $1(a) {
        return a.b !== "\x02"
    },
    $S: 30
}
X.iY.prototype = {
    $1(a) {
        return (a ^ this.a.f) >>> 0
    },
    $S: 2
}
X.iZ.prototype = {
    $1(a) {
        return (a ^ this.a.f) >>> 0
    },
    $S: 2
}
S.fK.prototype = {
    aM(a, b, c) {
        return true
    },
    b_(a) {
        return true
    },
    $iaN: 1
}
HtmlRenderer.inner_render.prototype = {
    e0(a) {
        // a -> profiler input
        var s, root, q, this_ = this

        if (this_.a == null) return

        A.vo(this_.gfd())
        // this_.d = P.Timer_Timer(P.duration_milsec_sec(10, 0), this_.gbc(this_))

        // this.gbc -> this.dI
        this_.d = P.Timer_Timer(P.duration_milsec_sec(0, 0), this.gbc(this_))

        if (!run_env.from_code) {
            W.es(window, "resize", this_.gff(this_), false)
        }

        this_.ds(0, null)
        s = HtmlRenderer.add_p("row")

        root = this_.b
        logger.debug("html fq e0 0")
        root.appendChild(s)
        logger.debug("html fq e0 1")

        q = HtmlRenderer.add_span("welcome")
        q.textContent = LangData.get_lang("CeaN")
        s.appendChild(q)

        q = HtmlRenderer.add_span("welcome2")
        q.textContent = LangData.get_lang("NosN")
        s.appendChild(q)

        profiler = this_.c
        if (profiler.gbu(profiler) != null) {
            profiler = profiler.gbu(profiler)
            root.appendChild(document.createTextNode(profiler))
        }
        // 添加 event listener
        logger.debug("加速等待器 注册")
        if (!run_env.from_code) {
            W.es(window, "message", this_.gfb(this_), false)
        }
    },
    // MARK: 接受加速按钮
    fc(func_self, event) {
        // var s = event.data,
        //     r = new P.kx([], [])
        // r.c = true
        // if (r.aO(s) === "??") {
        //     this.y = 2000
        // }
        if (event.data == "??") {
            this.y = 2000
            // 触发加速
        }
    },
    // MARK: resize
    ds(a, b) {
        if (run_env.from_code) {
            return
        }
        var s = this.a
        if (window.innerWidth < 500) {
            s.classList.remove("hlist")
            s.classList.add("vlist")
            s = this.b
            s.classList.remove("hbody")
            s.classList.add("vbody")
        } else {
            s.classList.remove("vlist")
            s.classList.add("hlist")
            s = this.b
            s.classList.remove("vbody")
            s.classList.add("hbody")
        }
    },
    dI(a) {
        this.c.ae(0, this.x)
    },
    // MARK: main?
    fe(a0) {
        // run update
        logger.debug("html.fq.fe start")
        var s, r, q, p, o, n, m, l, k, j, i, h, g, f, e, d, c, b, this_ = this
        if (a0.length < 6) return
        s = X.f4(a0, 0)
        r = C.Array.al(s, 0, s.length - 8)
        q = H._arrayInstanceType(r).i("a9<1>")
        p = q.i("y<M.E,l*>")
        o = t.bQ
        n = P.List_List_of(new H.y(H.b(C.e.bt(0, P.List_List_of(new H.y(new H.a9(r, q),
            new HtmlRenderer.jx(this_), p), true, p.i("M.E"))).split("\n"), t.s),
            new HtmlRenderer.jy(), o), true, o.i("M.E"))
        r = n.length
        if (r > 1) {
            // if (!J.Y(J.J(J.J(n[0], 0), 0), "")) {
            // 如果第一个元素不是空字符串
            if (n[0][0][0] !== "") {
                for (m = 0; m < n.length; n.length === r || (0, H.F)(n), ++m) {
                    l = n[m]
                    q = J.a3(l)
                    if (q.gp(l) > 1) this_.e = true
                    for (q = q.ga0(l); q.u();)
                        if (J.aw(q.gC()) > 7) this_.f = true
                }
                k = H.b([], t.t)
                for (r = n.length, q = this_.a, p = this_.b, m = 0; m < n.length; n.length === r || (0, H.F)(n), ++m) {
                    l = n[m]
                    o = J.a3(l)
                    if (o.gp(l) === 1 && J.aw(o.h(l, 0)) < 3) {
                        if (J.aw(o.h(l, 0)) > 1) k.push(o.h(l, 0))
                        continue
                    }
                    o = this_.e
                    j = this_.f
                    i = document.createElement("div")
                    i.classList.add("plrg_list")
                    h = new HtmlRenderer.jT(i)
                    h.e3(l, o, j)
                    q.appendChild(i)
                    p.appendChild(h.b)
                }
                for (r = k.length, m = 0; m < k.length; k.length === r || (0, H.F)(k), ++m) {
                    g = k[m]
                    f = document.createElement("p")
                    f.classList.add("row")
                    // f.textContent = J.J(g, 1)
                    f.textContent = g[1]
                    p.appendChild(f)
                }
            }
            r = this_.b
            q = document
            r.appendChild(q.createElement("hr"))
            r.appendChild(q.createElement("br"))
            q = $.ay
            // r -> 中间变量
            // this.y -> plrlen
            // this.r -> preboost
            q = this_.y = q.gp(q)

            r = q > 10 ? this_.y = 10 : q

            r += this_.r

            // this_.y = r
            // 这里才是有用的加速
            this_.y = 2000

            // if (r > 2000) this_.y = 2000

            if (this_.Q != null) return

            this_.b4()
            this_.z = n
            // console.log("start fq.fe end")
            // 合着压根不需要这操作是吧……
            // for (r = n.length, m = 0; m < n.length; n.length === r || (0, H.F)(n), ++m) {
            //     for (q = J.by(n[m]); q.u();) {
            //         // console.log("fq.fe q type", typeof n[m])
            //         console.log(q, m, n, r)
            //         J.ry(q.gC(), 4)
            //         // set length (J.ry)
            //     }
            // }
            // q = J.by(n[0])
            // q.u()
            // J.ry(q.gC(), 4)
        } else {
            e = n[0]
            r = J.a3(e)
            // q = J.J(r.h(e, 0), 0)
            q = r.h(e, 0)[0]
            r = r.h(e, 1)
            // d = J.J(r, 0)
            d = r[0]
            if (!$.ay.J(0, d)) {
                c = $.ay.h(0, q)
                b = HtmlRenderer.t8(c.a, r, false)
                b.b = c
                b.x.setAttribute("class", "sgl")
                r = c.f
                q = b.f
                t.A.a(r.parentElement).insertBefore(q, r.nextElementSibling)
                q = q.style
                q.display = "none"
            }
        }
    },
    b4() {
        // 实力评估 主循环?
        logger.debug("评估 主循环")
        var async_goto = 0,
            async_complete = P._makeAsyncAwaitCompleter(t.z),
            q, this_ = this,
            o
        var $async$b4 = P._wrapJsFunctionForAsync(function (async_error_code, async_result) {
            if (async_error_code === 1) return P.async_rethrow(async_result, async_complete)
            while (true) switch (async_goto) {
                case 0:
                    this_.d = null
                    o = this_.Q
                    async_goto = o == null || o.a.length === 0 ? 3 : 4
                    break
                case 3:
                    async_goto = 5
                    // 输出 "实力评估中...[2]%"
                    return P._asyncAwait(this_.c.O(), $async$b4)
                case 5:
                    this_.Q = async_result
                    async_goto = 6
                    // return P._asyncAwait(P.future_future_delayed(P.duration_milsec_sec(1, 0), t.z), $async$b4)
                    return P._asyncAwait(P.future_future_delayed(P.duration_milsec_sec(0, 0), t.z), $async$b4)
                // break
                case 6:
                    this_.db = null
                    this_.dx = true
                    this_.ch = 1800
                case 4:
                    o = this_.Q
                    if (o == null) {
                        async_goto = 1
                        break
                    }
                    this_.ft(C.Array.cu(o.a, 0))
                case 1:
                    return P.async_return(q, async_complete)
            }
        })
        // console.log("输出 实力评分.ing")
        return P._asyncStartSync($async$b4, async_complete)
    },
    ft(a) {
        var s, r, q, p, this_ = this
        if (a == $.K()) {
            this_.db = null
            this_.cy = true
            this_.b4()
            return
        }
        s = a.b
        r = this_.ch
        if (s < r) s = r
        this_.ch = a.c
        this_.cx = a
        q = this_.y
        if (q >= 2000) {
            p = this_.Q
            p = !(p == null || p.a.length === 0)
        } else p = false
        if (p) {
            this_.c5(this_.cy)
            this_.cy = false
        } else {
            // this_.d = P.Timer_Timer(P.duration_milsec_sec(C.JsInt.P(s, C.d.aI(Math.sqrt(q / 2))), 0), this_.gel())
            this_.d = P.Timer_Timer(P.duration_milsec_sec(0, 0), this_.gel())
        }
    },
    c5(a) {
        var s, r, this_ = this
        if (a) {
            s = this_.b
            r = C.d.aI(s.scrollHeight) - s.clientHeight
            a = r - C.d.aI(s.scrollTop) < 50 || C.d.aI(s.scrollTop) / r > 0.95
        }
        if (this_.cx instanceof T.dX) {
            this_.fQ()
        } else {
            s = this_.db
            if (s == null) {
                s = HtmlRenderer.add_p("row")
                this_.db = s
                this_.b.appendChild(s)
                if (this_.dx) this_.dx = false
                else {
                    s = this_.db;
                    (s && C.Q).cJ(s, "\u2003")
                }
            } else s.appendChild(document.createTextNode(", "))
            this_.db.appendChild(HtmlRenderer.uI(this_.cx))
            this_.b4()
        }
        if (a) {
            s = this_.b
            s.scrollTop = C.JsInt.aI(C.d.aI(s.scrollHeight) - s.clientHeight)
        }
    },
    em() {
        return this.c5(true)
    },
    fQ() {
        var s, r, q, p, o, n, m, l, k, j, i, h, g, this_ = this
        // e = "click",
        let d = this_.b,
            document_ = document
        d.appendChild(document_.createElement("br"))
        s = this_.cx.e.gb2()
        r = $.ay.h(0, s).a
        q = t.ak
        p = H.b([], q)
        o = H.b([], q)
        n = []
        $.ay.aw(0, new HtmlRenderer.jA(r, p, n, o))
        C.Array.bb(p, HtmlRenderer.oD())
        C.Array.bb(o, HtmlRenderer.oD())
        m = document_.createElement("table")
        l = new HtmlRenderer.jz(m)
        k = document_.createElement("tr")
        j = document_.createElement("td")
        k.appendChild(j)
        C.j.by(j, C.String.B(J.iN($.nh(), LangData.get_lang("ePya")), $.nh()), $.bV())
        q = j.style
        q.minWidth = "112px"
        q = j.style
        q.height = "32px"
        j = document_.createElement("td")
        k.appendChild(j)
        j.textContent = LangData.get_lang("AoUA")
        q = j.style
        q.width = "44px"
        j = document_.createElement("td")
        k.appendChild(j)
        j.textContent = LangData.get_lang("aXIa")
        q = j.style
        q.width = "44px"
        j = document_.createElement("td")
        k.appendChild(j)
        j.textContent = LangData.get_lang("MdQa")
        q = j.style
        q.minWidth = "112px"
        q = k.style
        q.background = "#FAFAFA"
        m.appendChild(k)
        for (q = p.length, i = 0; i < p.length; p.length === q || (0, H.F)(p), ++i) l.$1(p[i])
        k = document_.createElement("tr")
        j = document_.createElement("td")
        k.appendChild(j)
        C.j.by(j, C.String.B(J.iN($.nf(), LangData.get_lang("eFKN")), $.nf()), $.bV())
        q = j.style
        q.height = "32px"
        j = document_.createElement("td")
        k.appendChild(j)
        j.textContent = LangData.get_lang("AoUA")
        j = document_.createElement("td")
        k.appendChild(j)
        j.textContent = LangData.get_lang("aXIa")
        j = document_.createElement("td")
        k.appendChild(j)
        j.textContent = LangData.get_lang("MdQa")
        q = k.style
        q.background = "#FAFAFA"
        m.appendChild(k)
        for (q = o.length, i = 0; i < o.length; o.length === q || (0, H.F)(o), ++i) l.$1(o[i])
        d.appendChild(m)
        h = HtmlRenderer.add_div("buttonBar")
        d.appendChild(h)

        g = document_.createElement("button")
        g.textContent = LangData.get_lang("xPRN") // 返回
        h.appendChild(g)
        if (!run_env.from_code) {
            W.es(g, "click", new HtmlRenderer.jB(), false)
        }
        g = document_.createElement("button")
        g.textContent = LangData.get_lang("KXmn") // 分享
        h.appendChild(g)
        if (!run_env.from_code) {
            W.es(g, "click", new HtmlRenderer.jC(), false)
        }
        g = document_.createElement("button")
        g.textContent = LangData.get_lang("Zvon") // 帮助
        h.appendChild(g)
        if (!run_env.from_code) {
            W.es(g, "click", new HtmlRenderer.jD($.qq()), false)
        }
        d = h.style
        document_ = "" + (C.d.aI(m.offsetWidth) - C.d.aI(h.offsetWidth) - 8) + "px"
        d.marginLeft = document_
        if (W.ll(window.parent) !== window) {
            // new Z.jE(f, p, o, n, $.ay.h(0, J.J(J.J(f.z[0], 0), 0))).$0()
            new HtmlRenderer.send_win_data(this_, p, o, n, $.ay.h(0, this_.z[0][0][0])).$0()
        }

        // 显示 done_target
        logger.debug("done_target")
        window.parent.postMessage("done_fight", "*")
    }
}
HtmlRenderer.jx.prototype = {
    $1(a) {
        return (a ^ this.a.x) >>> 0
    },
    $S: 2
}
HtmlRenderer.jy.prototype = {
    $1(a) {
        var s = t.dG
        return P.List_List_of(new H.y(H.b(a.split("\r"), t.s), new HtmlRenderer.jw(), s), true, s.i("M.E"))
    },
    $S: 35
}
HtmlRenderer.jw.prototype = {
    $1(a) {
        return H.b(a.split("\t"), t.s)
    },
    $S: 36
}
HtmlRenderer.jA.prototype = {
    $2(a, b) {
        var this_ = this
        if (b.b == null)
            if (b.a === this_.a) {
                this_.b.push(b)
                this_.c.push(b.db)
            } else this_.d.push(b)
    },
    $S: 37
}
HtmlRenderer.jz.prototype = {
    $1(a) {
        var s, r, q = "beforeend",
            p = document,
            o = p.createElement("tr"),
            n = p.createElement("td")
        o.appendChild(n)
        C.j.bk(n, q, a.f.outerHTML, null, $.bV())
        n.classList.add("namdtd")
        n = p.createElement("td")
        o.appendChild(n)
        n.textContent = C.JsInt.k(a.c)
        n = p.createElement("td")
        o.appendChild(n)
        n.textContent = C.JsInt.k(a.d)
        s = a.e
        if (s != null) {
            r = $.ay.h(0, s)
            n = p.createElement("td")
            o.appendChild(n)
            C.j.bk(n, q, r.fr, null, null)
            n.classList.add("namdtd")
        } else o.appendChild(p.createElement("td"))
        this.a.appendChild(o)
    },
    $S: 38
}
HtmlRenderer.jB.prototype = {
    $1(a) {
        var s = t.X
        J.m0(W.ll(window.parent), P.dD(["button", "refresh"], s, s), "*")
    },
    $S: 6
}
HtmlRenderer.jC.prototype = {
    $1(a) {
        var s = t.X
        J.m0(W.ll(window.parent), P.dD(["button", "share"], s, s), "*")
    },
    $S: 6
}
HtmlRenderer.jD.prototype = {
    $1(a) {
        C.U.fg(window, this.a, "_blank")
    },
    $S: 6
}
HtmlRenderer.send_win_data.prototype = {
    $0() {
        var s = 0,
            r = P._makeAsyncAwaitCompleter(t.P),
            q = this,
            p, win_data, n
        var $async$$0 = P._wrapJsFunctionForAsync(function (a, b) {
            if (a === 1) return P.async_rethrow(b, r)
            while (true) switch (s) {
                case 0:
                    n = t.z
                    s = 2
                    // return P._asyncAwait(P.future_future_delayed(P.duration_milsec_sec(1, 0), n), $async$$0)
                    return P._asyncAwait(P.future_future_delayed(P.duration_milsec_sec(0, 0), n), $async$$0)
                // break
                case 2:
                    p = HtmlRenderer.rV(q.b, q.c)
                    win_data = P.dD(["winners",
                        q.d,
                        "all",
                        q.a.z,
                        "pic",
                        p.toDataURL("image/png", null),
                        "firstKill",
                        q.e.e
                    ], n, n)
                    // send win_data to parent
                    J.m0(W.ll(window.parent), win_data, "*")
                    // if (from_node) {
                    //     // 怎么着输出一下 win_data
                    // }
                    return P.async_return(null, r)
            }
        })
        return P._asyncStartSync($async$$0, r)
    },
    $S: 40
}
HtmlRenderer.jT.prototype = {
    e3(a, b, c) {
        var s, r, q, p, o = this
        if (b || c) o.b = HtmlRenderer.add_div("plrg_body_gouped")
        else o.b = HtmlRenderer.add_div("plrg_body")
        for (s = J.by(a), r = o.a; s.u();) {
            q = s.gC()
            if (J.aw(q) < 2) return
            p = HtmlRenderer.t7(o, q, c)
            r.appendChild(p.f)
            o.b.appendChild(p.r)
        }
    }
}
HtmlRenderer.ax.prototype = {
    da() {
        var s = this.b
        if (s != null) s.da()
        else ++this.d
    },
    dc(a) {
        var s = this.b
        if (s != null) s.dc(a)
        else this.c = this.c + a
    },
    cP(a, b, c, d) {
        var s, r, q, p, o, n, m, l, k, j, i = this,
            h = null,
            g = '<div class="plr_body ',
            f = '<div class="name"> ',
            e = "beforeend"
        i.cy = "pid" + i.cx
        if (c) i.r = HtmlRenderer.add_div("plr1")
        else i.r = HtmlRenderer.add_div("plr0")
        s = J.a3(b)
        i.db = s.h(b, 0)
        i.dx = s.h(b, 1)
        $.ay.m(0, i.db, i)
        i.fy = s.h(b, 2)
        i.dy = s.h(b, 3)
        r = i.y
        if (c) r.textContent = " " + H.as_string(i.db) + " "
        else r.textContent = " " + H.as_string(i.dx) + " "
        r = i.x
        r.toString
        q = Sgls.o6(i.fy)
        r.classList.add(q)
        if (J.nz(i.fy, $.aD())) i.y.textContent = " " + H.as_string(i.dx) + " "
        p = s.h(b, 4)
        o = J.m_(p, "+")
        if (o > -1) {
            r = i.go = P.oF(C.String.af(p, 0, o))
            p = C.String.ay(p, o)
        } else {
            r = i.go = P.oF(s.h(b, 4))
            p = h
        }
        n = "" + C.d.R(r / 4) + "px"
        r = i.z
        q = r.style
        q.width = n
        q = i.r
        q.appendChild(i.x)
        q.appendChild(i.y)
        m = J.m_(i.dy, "+")
        if (m > -1) {
            q = i.r
            l = HtmlRenderer.add_span("small")
            l.textContent = J.nB(i.dy, m)
            q.appendChild(l)
            i.r.appendChild(document.createTextNode(" "))
        }
        i.fr = g + i.cy + '">' + H.as_string(i.x.outerHTML) + f + C.o.ab(i.dx) + " </div></div>"
        i.fx = g + i.cy + '">' + H.as_string(i.x.outerHTML) + f + C.o.ab(i.dx) + ' </div><div class="maxhp" style="width: ' + n + '" /></div>'
        if (c) {
            k = HtmlRenderer.add_div("detail")
            q = i.r
            l = LangData.get_lang("BxJN") + (" " + H.as_string(i.go))
            j = document
            q.appendChild(j.createTextNode(l))
            if (p != null) {
                q = i.r
                l = HtmlRenderer.add_span("small")
                l.textContent = p
                q.appendChild(l)
            }
            i.r.appendChild(k)
            i.r.appendChild(j.createElement("br"))
            d.a = 5
            C.h.cJ(k, H.oO(LangData.get_lang("ezfN"), "[]", new HtmlRenderer.jV(d, b), h))
            // if (!J.Y(s.h(b, 12), "")) {
            if (s.h(b, 12) !== "") {
                switch (s.h(b, 12)) {
                    case "2":
                        C.h.bk(k, e, C.String.B(" ", $.qC()), h, $.bV())
                        break
                    case "1":
                        C.h.bk(k, e, C.String.B(" ", $.qB()), h, $.bV())
                        break
                    case "0":
                        C.h.bk(k, e, C.String.B(" ", $.qA()), h, $.bV())
                        break
                    default:
                        C.h.bk(k, e, C.String.B(" ", $.qv()), h, $.bV())
                }
            }
        }
        s = t.A
        i.x = s.a(i.x.cloneNode(true))
        s = s.a(i.y.cloneNode(true))
        i.y = s
        s.textContent = " " + H.as_string(i.dx) + " "
        s = i.f
        s.appendChild(i.x)
        s.appendChild(i.y)
        r.appendChild(i.Q)
        r.appendChild(i.ch)
        s.appendChild(r)
        i.bU(i.go)
    },
    bU(a) {
        var s, r, q, p = this
        p.go = a
        s = "" + C.d.R(a / 4) + "px"
        r = p.Q.style
        r.width = s
        r = p.ch.style
        r.width = s
        r = p.f
        if (a <= 0) {
            r = r.style
            r.toString
            C.i.d4(r, C.i.cU(r, "opacity"), "0.5", "")
        } else {
            q = r.style
            q.toString
            C.i.d4(q, C.i.cU(q, "opacity"), "", "")
            r = r.style
            r.display = ""
        }
    }
}
HtmlRenderer.jV.prototype = {
    $1(a) {
        // return HtmlRenderer.t9(J.J(this.b, this.a.a++))
        return HtmlRenderer.t9(this.b[this.a.a++])
    },
    $S: 17
}
HtmlRenderer.fW.prototype = {}
HtmlRenderer.lp.prototype = {
    $1(a) {
        var s, r, q
        if (a instanceof T.NPlr) return $.ay.h(0, a.a).fr
        if (a instanceof T.HPlr) {
            s = $.ay.h(0, a.a)
            // plv.updateHp(obj.newHp);
            // console.log("lp.$1", s)
            s.bU(a.d)
            a.b = s.cy
            this.a.push(a)
            return s.fx
        }
        if (a instanceof T.DPlr) {
            s = $.ay.h(0, a.a)
            r = this.b.e
            if (r != null) {
                r = r.gb2()
                s.e = r
                q = $.ay
                s.toString
                q.h(0, r).da()
            }
            s.bU(0)
            this.a.push(a)
            return s.fr
        }
        if (a instanceof T.MPlr) {
            s = $.ay.h(0, a.a)
            s.bU(a.b)
            r = "" + C.d.R(a.c / 4) + "px"
            q = s.z.style
            q.width = r
            s.fx = '<div class="plr_body ' + s.cy + '"><div class="sgl ' + H.as_string(Sgls.o6(s.fy)) + '"></div>' + H.as_string(s.y.outerHTML) + '<div class="maxhp" style="width: ' + r + '" /></div>'
            return s.fr
        }
        if (a instanceof T.HDamage) return '<div class="damage">' + H.as_string(a.a) + "</div>"
        if (a instanceof T.HRecover) return '<div class="recover">' + H.as_string(a.a) + "</div>"
        return J.b4(a)
    },
    $S: 42
}
HtmlRenderer.lq.prototype = {
    $1(a) {
        var s, r = this,
            q = a.cF(0)
        if (q === "[0]") return r.a.$1(r.b.e)
        else if (q === "[1]") return r.a.$1(r.b.f)
        else if (q === "[2]") return r.a.$1(r.b.x)
        else {
            s = J.aQ(q)
            if (r.b instanceof T.h2) return '<span class="sctext">' + s.af(q, 1, q.length - 1) + "</span>"
            else return '<span class="stext">' + s.af(q, 1, q.length - 1) + "</span>"
        }
    },
    $S: 17
}
Sgls.k7.prototype = {
    $2(a, b) {
        var s, r, q = "data:image/gif;base64," + H.as_string(b),
            p = $.e_
        $.e_ = p + 1
        s = "icon_" + p
        r = H.as_string(a) + "@!"
        $.k8.m(0, r, s)
        $.mg.m(0, r, q)
        if (!run_env.from_code) {
            t.w.a(C.v.gbl(document.styleSheets)).insertRule("div." + s + ' { background-image:url("' + q + '"); }', $.e_ - 1)
        }
    },
    $S: 65
}
Sgls.k4.prototype = {
    $0() {
        var s, r, q, p, o, n, m, l, k, j, i, h = new Array($.d7())
        h.fixed$length = Array
        s = H.b(h, t.gt)
        for (h = t.he, r = 0; q = $.d7(), r < q; ++r) {
            q = new Array(q)
            q.fixed$length = Array
            q = H.b(q, h)
            s[r] = q
            q[r] = 0
        }
        for (r = 1; r < $.d7(); ++r)
            for (p = 0; p < r; ++p) {
                h = $.mf
                q = h[r]
                o = q[0]
                h = h[p]
                n = h[0]
                m = (o - n) * 0.3
                l = (q[1] - h[1]) * 0.4
                k = (q[2] - h[2]) * 0.25
                j = o * 0.15 + o * 0.25 + o * 0.1 - (n * 0.15 + n * 0.25 + n * 0.1)
                i = Math.sqrt(m * m + l * l + k * k + j * j)
                J.lT(s[p], r, i)
                J.lT(s[r], p, i)
            }
        return s
    },
    $S: 44
}
Sgls.k5.prototype = {
    $1(a) {
        return ((a ^ 6) >>> 0) * 99 + 218 & 255
    },
    $S: 2
}
Sgls.k6.prototype = {
    $1(a) {
        var s, r, q, p = this,
            o = p.a
        if (o.length > 0)
            if (a === p.b) {
                s = p.c
                s = s[0] !== s[1]
            } else s = false
        else s = false
        if (s) return true
        // if (J.J(J.J($.nv(), a), p.b) < 90)
        if ($.nv()[a][p.b] < 90) {
            return false
        }
        for (s = o.length, r = 0; r < s; ++r)
            if (o[r] === a) return true
        for (r = 0; r < o.length; o.length === s || (0, H.F)(o), ++r) {
            q = o[r]
            // if (J.J(J.J($.nv(), a), q) < 90) {
            if ($.nv()[a][q] < 90) {
                return false
            }
        }
        return true
    },
    $S: 45
}
LangData.lA.prototype = {
    $2(a, b) {
        if (typeof b == "string" && !C.String.w(b, "<") && !C.String.w(b, ">")) $.od.m(0, LangData.eQ(H.lg(a)), b)
    },
    $S: 23
}
Sgls.c.prototype = {
    j(a, b) {
        var s, r, q, p = this
        if (b.a === p) return
        if (b.ga4() === 1 / 0 || p.b === p) {
            p.bH(p.c, b)
            return
        }
        s = b.ga4()
        r = t.gl
        if (r.a(p.c).ga4() <= s) {
            p.bH(p.c, b)
            return
        }
        q = r.a(p.b)
        for (; true;) {
            if (q.ga4() > s) {
                p.bH(q.c, b)
                return
            }
            q = r.a(q.b)
        }
        p.bH(p.c, b)
    },
    U(a, b) {
        if (b.a !== this) return false
        this.d8(b)
        return true
    },
    ga0(a) {
        return new Sgls.a_(this, this.b, this.$ti.i("a_<1*>"))
    },
    gp(a) {
        return this.a
    },
    ah(a) {
        var s, r, q = this,
            p = q.b
        for (s = q.$ti.i("1*"); p !== q; p = r) {
            s.a(p)
            r = p.gaE()
            p.sc8(null)
            p.sbq(null)
            p.saE(null)
        }
        q.c = q
        q.b = q
        q.a = 0
    },
    gbv(a) {
        return this.a === 0
    },
    bH(a, b) {
        var s
        if (b.a != null) throw H.wrap_expression(P.cd("MEntry is already in a MList"))
        b.a = this
        s = a.gaE()
        s.sbq(b)
        b.c = a
        b.b = s
        a.saE(b);
        ++this.a
    },
    d8(a) {
        a.b.sbq(a.c)
        a.c.saE(a.b);
        --this.a
        a.a = null
    },
    gaE() {
        return this.b
    },
    saE(a) {
        return this.b = a
    },
    sbq(a) {
        return this.c = a
    }
}
Sgls.a_.prototype = {
    gC() {
        return this.b
    },
    u() {
        var s = this,
            r = s.c
        if (r === s.a) {
            s.b = null
            return false
        }
        s.$ti.i("1*").a(r)
        s.b = r
        s.c = r.gaE()
        if (s.b.gc8() == null) return s.u()
        return true
    }
}
Sgls.n.prototype = {
    ga4() {
        return 1e4
    },
    D() {
        var s = this.a
        if (s != null) s.d8(this)
    },
    gc8() {
        return this.a
    },
    gaE() {
        return this.b
    },
    sc8(a) {
        return this.a = a
    },
    saE(a) {
        return this.b = a
    },
    sbq(a) {
        return this.c = a
    }
}
T.SklAbsorb.prototype = {
    au(a, b) {
        var s
        if (b) {
            s = this.r
            if (s.fy - s.fx < $.at()) return false
        }
        return this.aX(a, b)
    },
    v(a, b, c, d) {
        var s = a[0].a,
            r = T.I(this.r, true, c),
            q = $.ph()
        d.a.push(T.RunUpdate(LangData.get_lang("FfpA"), this.r, s, null, null, $.i(), 1000, 100))
        s.a3(r * q, true, this.r, T.v6(), c, d)
    }
}
T.SklAccumulate.prototype = {
    au(a, b) {
        var s
        if (this.fr.a != null) return false
        if (b) {
            s = this.r
            if (s.fx < $.cZ()) return false
            if (s.r2.h(0, $.lN()) != null) return false
        }
        return this.aX(a, b)
    },
    aa(a, b, c) {
        return H.b([], t.F)
    },
    v(a, b, c, d) {
        var s = this,
            r = null,
            q = LangData.get_lang("zEuN"),
            p = s.r,
            o = d.a
        o.push(T.RunUpdate(q, p, p, r, r, $.i(), 1000, 100))
        s.r.rx.j(0, s.fr)
        s.r.r2.m(0, $.lN(), s)
        if (s.r.r2.J(0, $.a7())) {
            s.fx = s.fx + $.i()
            q = s.r
            q.l = q.l + $.pM()
        }
        s.r.F()
        q = s.r
        q.l = q.l + $.lM()
        q = C.String.B(LangData.get_lang("gIKN"), $.qu())
        p = s.r
        o.push(T.RunUpdate(q, p, p, r, r, 0, 1000, 100))
    },
    ar(a) {
        a.id = a.id * this.fx
    },
    gT() {
        return $.i()
    },
    K(a, b) {
        var s, r = this
        r.fr.D()
        r.r.r2.U(0, $.lN())
        r.r.F()
        if (a != null) {
            s = b.a
            s.push($.K())
            s.push(T.aO(LangData.get_lang("xrNA"), a, r.r))
        }
        r.fx = $.pi()
    },
    $ix: 1
}
T.SklAssassinate.prototype = {
    au(a, b) {
        if (b && this.r.r2.J(0, $.bT())) return false
        return this.aX(a, b)
    },
    as(a, b) {
        if (b) return a.fx > $.eU()
        return true
    },
    a9(a, b, c) {
        return this.bx(a, b, c, true)
    },
    aa(a, b, c) {
        if (this.fy != null) return H.b([], t.F)
        return this.dU(0, b, c)
    },
    v(a, b, c, d) {
        var s, r, q, p = this,
            o = null,
            n = p.fy
        if (n == null) {
            p.fy = a[0].a
            d.a.push(T.RunUpdate(LangData.get_lang("RmAN"), p.r, p.fy, o, o, $.i(), 1000, 100))
            p.r.x1.j(0, p.fr)
            n = p.r
            n.l = n.l + n.dx * $.B()
            n = n.r2.J(0, $.a7())
            s = p.r
            if (n) s.l = s.l + $.p8()
            else s.G.j(0, p.fx)
        } else {
            p.ah(0)
            if (n.fx > 0) {
                s = d.a
                s.push(T.RunUpdate(LangData.get_lang("iLaN"), p.r, n, o, o, $.i(), 1000, 100))
                r = T.I(p.r, true, c)
                q = T.I(p.r, true, c)
                if (q > r) r = q
                q = T.I(p.r, true, c)
                if (q > r) r = q
                if (n.a7($.d2(), c)) {
                    // dodge (通用回避)
                    // [0][回避]了攻击
                    s.push(T.RunUpdate(LangData.get_lang("BtqN"), n, p.r, o, o, 0, 1000, 100))
                    return
                }
                n.bN(r * $.mZ(), true, p.r, T.ad(), c, d)
            }
        }
    },
    aD(a, b, c, d) {
        var s = d.a
        s.push($.K())
        s.push(T.aO(LangData.get_lang("kMgn"), this.r, this.fy))
        this.ah(0)
    },
    aN(a, b, c, d) {
        var s = this.fy
        if (s != null && s.fx > 0) return this
        else this.ah(0)
        return null
    },
    ah(a) {
        this.fy = null
        this.fx.D()
        this.fr.D()
    }
}
T.dd.prototype = {
    gT() {
        return -$.i()
    },
    b9(a) {
        return a.b5(this.r.y.a.e)
    },
    a9(a, b, c) {
        return c.gbo() * a.H
    },
    aN(a, b, c, d) {
        return this
    },
    aP(a) {
        var s = this
        s.r.r2.m(0, $.aJ(), s)
        s.r.x1.j(0, s)
    },
    K(a, b) {
        var s, r = this
        r.D()
        r.r.r2.U(0, $.aJ())
        if (r.r.fx > 0) {
            s = b.a
            s.push($.K())
            s.push(T.aO(LangData.get_lang("cHVa"), a, r.r))
        }
    },
    v(a, b, c, d) {
        var s, r, q, p = this
        p.fr = p.fr - 1
        s = a[0].a
        r = T.I(p.r, false, c)
        q = $.eV()
        d.a.push(T.RunUpdate(LangData.get_lang("UeAn"), p.r, s, null, null, 0, 1000, 100))
        s.a3(r * q, false, p.r, T.ad(), c, d)
        if (p.fr == 0) p.K(null, d)
    },
    $ix: 1,
    $iaV: 1
}
T.SklBerserk.prototype = {
    as(a, b) {
        if (b) {
            if (a.r2.h(0, $.aJ()) != null) return false
            return !(a instanceof T.aM)
        }
        return true
    },
    a9(a, b, c) {
        var s = this.bC(a, b, c),
            r = a.r2
        return r.h(0, $.aJ()) != null || r.h(0, $.aE()) != null ? s / $.eV() : s
    },
    v(a, b, c, d) {
        var s = a[0].a,
            r = T.I(this.r, true, c)
        d.a.push(T.RunUpdate(LangData.get_lang("wnjN"), this.r, s, null, null, $.i(), 1000, 100))
        s.a3(r, true, this.r, T.v7(), c, d)
    }
}
T.SklCharge.prototype = {
    au(a, b) {
        if (this.r.r2.J(0, $.a7())) return false
        if (b)
            if (this.r.fx < $.ci()) return false
        return this.aX(a, b)
    },
    aa(a, b, c) {
        return H.b([], t.F)
    },
    v(a, b, c, d) {
        var s = this,
            r = LangData.get_lang("yUxA"),
            q = s.r
        d.a.push(T.RunUpdate(r, q, q, null, null, $.i(), 1000, 100))
        s.fy = s.fy + $.t()
        s.r.x2.j(0, s.fx)
        s.r.rx.j(0, s.fr)
        s.r.r2.m(0, $.a7(), s)
        s.r.F()
        q = s.r
        q.go = q.go + $.at()
    },
    at(a, b) {
        var s = this.fy - 1
        this.fy = s
        if (s <= 0) this.K(null, b)
    },
    ar(a) {
        a.id = a.id * $.B()
    },
    gT() {
        return $.i()
    },
    K(a, b) {
        var s, r = this
        r.fx.D()
        r.fr.D()
        r.r.r2.U(0, $.a7())
        r.r.F()
        if (a != null) {
            s = b.a
            s.push($.K())
            s.push(T.aO(LangData.get_lang("WNcn"), a, r.r))
        }
    },
    $ix: 1
}
T.dj.prototype = {
    gT() {
        return -$.i()
    },
    ar(a) {
        this.x.z = this.r
    },
    at(a, b) {
        var s = this.z - 1
        this.z = s
        if (s === 0) this.K(null, b)
    },
    aP(a) {
        var s = this,
            r = s.x
        r.r2.m(0, $.aE(), s)
        r.rx.j(0, s)
        r.x2.j(0, s.y)
        r.F()
    },
    K(a, b) {
        var s, r
        this.D()
        s = this.x
        s.r2.U(0, $.aE())
        this.y.D()
        s.F()
        if (s.fx > 0) {
            r = b.a
            r.push($.K())
            r.push(T.aO(LangData.get_lang("EsXa"), a, s))
        }
    },
    $ix: 1
}
T.SklCharm.prototype = {
    as(a, b) {
        var s
        if (b) {
            s = a.r2
            if (s.J(0, $.aE()) && t.o.a(s.h(0, $.aE())).z > $.i()) return false
        }
        return true
    },
    a9(a, b, c) {
        var s = this.bZ(a, b, c, true),
            r = a.r2
        return r.h(0, $.aE()) != null || r.h(0, $.aJ()) != null ? s / $.t() : s
    },
    v(a, b, c, d) {
        var s, r, q = this,
            p = null,
            o = a[0].a,
            n = d.a
        // sklCharm
        // [0]使用[魅惑]
        n.push(T.RunUpdate(LangData.get_lang("UUan"), q.r, o, p, p, $.i(), 1000, 100))
        if (!o.a7($.aE(), c)) s = o.fx > 0 && !o.A && T.bW(q.r.dx, o.db + o.dy, c)
        else s = true
        if (s) {
            // dodge (通用回避)
            // [0][回避]了攻击
            n.push(T.RunUpdate(LangData.get_lang("BtqN"), o, q.r, p, p, $.as(), 1000, 100))
            return
        }
        r = t.o.a(o.r2.h(0, $.aE()))
        if (r == null) {
            r = T.nG(q.r.z, o)
            r.aP(0)
        } else {
            s = q.r.z
            if (s != r.r) r.r = s
            else r.z = r.z + 1
        }
        if (q.r.r2.J(0, $.a7())) r.z = r.z + $.B()
        // sklCharmHit
        // [1]被[魅惑]了
        n.push(T.RunUpdate(C.String.B(LangData.get_lang("yjhn"), $.nd()), q.r, o, p, p, $.cZ(), 1000, 100))
    }
}
T.dI.prototype = {
    gT() {
        return 0
    }
}
T.dR.prototype = {
    gap() {
        return this.a6
    },
    bs() {
        var s, r, q, p, o = this.k1,
            n = o.length,
            m = this.cm
        if (n === m.k1.length)
            for (s = 0; s < n; ++s) {
                r = o[s]
                q = r.f
                p = m.k1[s].f
                if (q > p) r.f = p
            }
        this.dR()
    },
    aU() {
        var s = this.cm.q
        s = H.b(s.slice(0), H._arrayInstanceType(s))
        this.q = s
        this.ci()
    },
    bf() {
        var s = T.lC(this.a6.a),
            r = T.lC(this.b),
            q = $.a4()
        this.x = Math.max(H.ar(s), r - q)
    },
    $ibC: 1
}
T.SklClone.prototype = {
    aa(a, b, c) {
        return H.b([], t.F)
    },
    v(a, b, c, d) {
        var s, r, q, p, o, n, m, l, k = this,
            j = null
        k.f = C.d.R(k.f * ((c.n() & 63) + $.au()) / $.cj())
        if (!k.r.r2.J(0, $.a7())) {
            s = k.r.q
            for (r = 0; q = $.ap(), r < q; ++r) s[r] = C.d.R(s[r] * $.p1())
            s[q] = C.d.R(s[q] * $.b0())
            q = k.r
            q.fx = C.d.R(q.fx * $.b0())
            k.r.ci()
            k.r.F()
        }
        p = T.nU(k.r)
        p.y = k.r.y
        p.az()
        p.l = c.n() * $.C() + $.eX()
        q = k.r
        p.fx = q.fx
        if (q.fx + q.dx < c.n()) {
            q = k.f
            o = $.i()
            k.f = C.JsInt.am(q, o) + o
        }
        q = C.Array.dl(p.k1, new T.k9())
        if (q != null) q.f = C.d.R(Math.sqrt(H.ar(k.f)))
        q = LangData.get_lang("yWWn")
        o = new T.MPlr()
        o.cO(k.r)
        n = d.a
        n.push(T.RunUpdate(q, o, k.r, j, j, $.a6(), 1000, 100))
        k.r.y.aZ(p)
        o = LangData.get_lang("pKQn")
        q = k.r
        m = p.fx
        l = new T.HPlr(m)
        l.a = p.e
        l.d = m
        n.push(T.RunUpdate(o, q, l, j, j, 0, 1000, 100))
    }
}
T.k9.prototype = {
    $1(a) {
        return a instanceof T.SklClone
    },
    $S: 46
}
T.SklCritical.prototype = {
    v(a, b, c, d) {
        var s = this,
            r = a[0].a,
            q = T.I(s.r, false, c) * $.pf(),
            p = T.I(s.r, false, c) * $.eV()
        if (p > q) q = p
        p = T.I(s.r, false, c) * $.pg()
        if (p > q) q = p
        d.a.push(T.RunUpdate(LangData.get_lang("mFkn"), s.r, r, null, null, $.i(), 1000, 100))
        r.a3(q, false, s.r, T.ad(), c, d)
    }
}
T.dn.prototype = {
    gT() {
        return -$.i()
    },
    aq(a, b, c, d, e) {
        var s = this
        if (a > 0 && (d.n() & 63) < s.z) {
            e.a.push(T.RunUpdate(LangData.get_lang("wTSa"), s.r, s.x, null, null, 0, 1000, 100))
            a *= s.Q
        }
        return a
    },
    ar(a) {
        a.N = a.N * $.C()
    },
    K(a, b) {
        var s, r
        this.D()
        s = this.x
        s.r2.U(0, $.bh())
        s.rx.U(0, this.y)
        s.F()
        if (s.fx > 0) {
            r = b.a
            r.push($.K())
            r.push(T.aO(LangData.get_lang("yULA"), a, s))
        }
    },
    $ix: 1
}
T.SklCurse.prototype = {
    as(a, b) {
        var s
        if (b) {
            if (!(a.fx < $.b3())) {
                s = a.r2
                s = s.J(0, $.bh()) && t.dK.a(s.h(0, $.bh())).z > $.at()
            } else s = true
            if (s) return false
        }
        return true
    },
    a9(a, b, c) {
        var s = this.bC(a, b, c)
        return a.r2.h(0, $.bh()) != null ? s / $.t() : s
    },
    v(a, b, c, d) {
        var s = a[0].a,
            r = T.I(this.r, true, c)
        d.a.push(T.RunUpdate(LangData.get_lang("AqCN"), this.r, s, null, null, $.i(), 1000, 100))
        s.a3(r, true, this.r, T.v9(), c, d)
    }
}
T.SklDisperse.prototype = {
    a9(a, b, c) {
        var s = this.bC(a, b, c)
        return b && a instanceof T.aM && a.fx > $.ci() ? s * $.t() : s
    },
    v(a, b, c, d) {
        var s = this,
            r = null,
            q = "Dt.shield",
            p = a[0].a,
            o = T.I(s.r, true, c),
            n = d.a
        // sklDisperse [0]使用[净化]
        n.push(T.RunUpdate(LangData.get_lang("cDPa"), s.r, p, r, r, $.as(), 1000, 100))
        if (p.a7($.lP(), c)) {
            // dodge (通用回避)
            // [0][回避]了攻击
            n.push(T.RunUpdate(LangData.get_lang("BtqN"), p, s.r, r, r, $.as(), 1000, 100))
            return
        }
        n = p.r2
        if (n.J(0, q)) n.h(0, q).K(s.r, d)
        if (n.J(0, "Dt.iron")) n.h(0, "Dt.iron").K(s.r, d)
        if (p instanceof T.aM) p.bN(o * $.pw(), true, s.r, T.oI(), c, d)
        else p.bN(o, true, s.r, T.oI(), c, d)
    }
}
T.SklExchange.prototype = {
    as(a, b) {
        if (b) return a.fx - this.r.fx > $.at()
        return a.fx > this.r.fx
    },
    a9(a, b, c) {
        var s = this.bZ(a, b, c, true)
        return b ? s * a.fx : s
    },
    v(a, b, c, d) {
        var s, r, q, p, o, n, m, l = this,
            k = null
        l.f = C.JsInt.P(l.f + $.i(), $.t())
        s = a[0].a
        r = d.a
        r.push(T.RunUpdate(LangData.get_lang("fcfa"), l.r, s, k, k, $.i(), 1000, 100))
        if (!s.a7($.d3(), c)) q = s.fx > 0 && !s.A && !l.r.r2.J(0, $.a7()) && T.bW(l.r.dx, s.dy + s.cx + s.db, c)
        else q = true
        if (q) {
            // dodge (通用回避)
            // [0][回避]了攻击
            r.push(T.RunUpdate(LangData.get_lang("BtqN"), s, l.r, k, k, $.as(), 1000, 100))
            return
        }
        if (l.r.r2.J(0, $.a7())) {
            q = l.r
            q.l = q.l + s.l
            s.l = 0
        }
        q = l.r
        p = q.fx
        o = s.fx
        q.fx = o
        s.fx = p
        n = q.fx
        m = q.fy
        if (n > m) q.fx = m
        q = C.String.B(LangData.get_lang("RQta"), $.qD())
        n = l.r
        m = new T.HPlr(p)
        m.a = n.e
        m.d = n.fx
        n = new T.HPlr(o)
        n.a = s.e
        n.d = s.fx
        r.push(T.RunUpdate(q, m, n, k, k, (o - p) * $.t(), 1000, 100))
        s.cr(o - s.fx, o, l.r, c, d)
    }
}
T.c3.prototype = {
    gT() {
        return -$.i()
    }
}
T.SklFire.prototype = {
    v(a, b, c, d) {
        var s, r, q, p = a[0].a,
            o = t.a.a(p.r2.h(0, $.eY()))
        if (o == null) o = new T.c3($.ao())
        s = T.I(this.r, true, c)
        r = $.mM()
        q = o.b
        d.a.push(T.RunUpdate(LangData.get_lang("mAoA"), this.r, p, null, null, $.i(), 1000, 100))
        p.a3(s * (r + q), true, this.r, T.oJ(), c, d)
    }
}
T.sklHalf.prototype = {
    as(a, b) {
        var s
        if (b) {
            s = a.fx
            return s > $.eU() && s < $.lM()
        }
        return true
    },
    a9(a, b, c) {
        return this.bx(a, b, c, true) * a.fx
    },
    v(a, b, c, d) {
        var s, r, q, p, o, n, m, l, k, j, i = this,
            h = null,
            g = a[0].a,
            f = d.a
        f.push(T.RunUpdate(LangData.get_lang("lSVA"), i.r, g, h, h, $.i(), 1000, 100))
        s = i.r.fr + C.JsInt.P($.pG() - g.fx, $.B())
        r = 0
        if (s < r) s = r
        if (!g.a7($.eZ(), c)) q = g.fx > 0 && !g.A && !i.r.r2.J(0, $.a7()) && T.bW(s, g.dy + g.db, c)
        else q = true
        if (q) {
            // dodge (通用回避)
            // [0][回避]了攻击
            f.push(T.RunUpdate(LangData.get_lang("BtqN"), g, i.r, h, h, $.as(), 1000, 100))
            return
        }
        p = g.fx
        q = i.r
        o = q.dx
        n = g.dy
        m = $.t()
        l = C.JsInt.P(o - C.JsInt.P(n, m), m) + $.pL()
        if (q.r2.J(0, $.a7())) l = i.r.dx + $.b1()
        k = $.q7()
        if (l > k) l = k
        q = g.fx
        o = $.ci()
        o = C.d.R(q * (o - l) / o)
        g.fx = o
        j = p - o
        o = LangData.get_lang("Hxra")
        q = i.r
        n = new T.HPlr(p)
        n.a = g.e
        n.d = g.fx
        f.push(T.RunUpdate(o, q, n, new T.HDamage(l), h, j, 1000, 100))
        if (j > 0) g.cr(j, p, i.r, c, d)
    }
}
T.dw.prototype = {
    gT() {
        return $.i()
    },
    ar(a) {
        var s = this.x
        s.cy = s.cy * this.z
    },
    at(a, b) {
        var s = this.Q - 1
        this.Q = s
        if (s === 0) this.K(null, b)
    },
    K(a, b) {
        var s, r
        this.D()
        s = this.x
        s.r2.U(0, $.d4())
        this.y.D()
        s.F()
        if (s.fx > 0) {
            r = b.a
            r.push($.K())
            r.push(T.aO(LangData.get_lang("wlqa"), a, s))
        }
    },
    $ix: 1
}
T.SklHaste.prototype = {
    b9(a) {
        return a.b5(this.r.z.f)
    },
    as(a, b) {
        var s
        if (b) {
            if (a.fx < $.a6()) return false
            s = a.r2
            if (s.h(0, $.d4()) != null && (t.e_.a(s.h(0, $.d4())).Q + $.i()) * $.a6() > a.fx) return false
            return !(a instanceof T.aM)
        }
        return true
    },
    a9(a, b, c) {
        var s
        if (b) {
            s = T.f_(a) * a.M
            return a.r2.h(0, $.d4()) != null ? s / $.C() : s
        }
        return c.gbo()
    },
    v(a, b, c, d) {
        var s, r, q, p = this,
            o = null,
            n = a[0].a,
            m = d.a
        m.push(T.RunUpdate(LangData.get_lang("pHka"), p.r, n, o, o, $.a6(), 1000, 100))
        s = p.r
        s.l = s.l + s.cy
        s = n.r2
        r = t.e_.a(s.h(0, $.d4()))
        if (r == null) {
            r = new T.dw(n, $.t(), $.B())
            r.y = new T.b8(r)
            s.m(0, $.d4(), r)
            n.rx.j(0, r)
            n.x2.j(0, r.y)
            n.F()
        } else r.Q = r.Q + $.t()
        if (p.r.r2.J(0, $.a7())) {
            s = r.z
            q = $.t()
            r.z = s + q
            r.Q = r.Q + q
        }
        m.push(T.RunUpdate(C.String.B(LangData.get_lang("DDWN"), $.qE()), p.r, n, o, o, 0, 1000, 100))
    }
}
T.SklHeal.prototype = {
    b9(a) {
        return a.b5(this.r.z.f)
    },
    as(a, b) {
        if (b) return a.fx + $.b3() < a.fy
        return a.fx < a.fy
    },
    a9(a, b, c) {
        var s = {}
        if (b) {
            s.a = a.fy - a.fx
            a.r2.aw(0, new T.ka(s))
            return s.a = s.a * a.M
        }
        return c.gbo()
    },
    v(a, b, c, d) {
        var s, r, q, p, o, n, m, l = this,
            k = l.f
        if (k > $.av()) l.f = k - 1
        s = a[0].a
        r = C.d.R(T.I(l.r, true, c) / $.pQ())
        q = s.fy - s.fx
        if (r > q) r = q
        k = d.a
        k.push(T.RunUpdate(LangData.get_lang("Yiea"), l.r, s, null, null, r, 1000, 100))
        p = s.fx
        s.fx = p + r
        o = LangData.get_lang("imin")
        n = l.r
        m = new T.HPlr(p)
        m.a = s.e
        m.d = s.fx
        k.push(T.RunUpdate(o, n, m, new T.HRecover(r), null, 0, 1000, 100))
        s.bL(l.r, d)
    }
}
T.ka.prototype = {
    $2(a, b) {
        var s
        if (b.gT() < 0) {
            s = this.a
            s.a = s.a + $.au()
        }
    },
    $S: 16
}
T.dx.prototype = {
    gT() {
        return -$.i()
    },
    ar(a) {
        a.A = true
    },
    fo(a, b, c) {
        var s, r = this,
            q = 0
        if (a > q) {
            s = r.y
            if (s > q) {
                r.y = s - a
                return q
            } else if (a + r.r.l >= $.bx()) {
                r.K(null, c)
                return 0
            }
        }
        return a
    },
    K(a, b) {
        var s, r
        this.D()
        s = this.r
        s.r2.U(0, $.bS())
        this.x.D()
        s.F()
        if (s.fx > 0) {
            r = b.a
            r.push($.K())
            r.push(T.aO(LangData.get_lang("aQYN"), a, s))
        }
    },
    $ix: 1
}
T.SklIce.prototype = {
    a9(a, b, c) {
        var s = this.bC(a, b, c)
        return a.r2.h(0, $.bS()) != null ? s / $.t() : s
    },
    v(a, b, c, d) {
        var s = a[0].a,
            r = T.I(this.r, true, c),
            q = $.p0()
        d.a.push(T.RunUpdate(LangData.get_lang("yMvn"), this.r, s, null, null, $.i(), 1000, 100))
        s.a3(r * q, true, this.r, T.mE(), c, d)
    }
}
T.SklIron.prototype = {
    ga4() {
        return $.pJ()
    },
    au(a, b) {
        if (this.fr.a != null) return false
        return this.aX(a, b)
    },
    aa(a, b, c) {
        return H.b([], t.F)
    },
    v(a, b, c, d) {
        var s = this,
            r = null,
            q = LangData.get_lang("syPN"),
            p = s.r,
            o = d.a
        o.push(T.RunUpdate(q, p, p, r, r, $.a6(), 1000, 100))
        s.r.y2.j(0, s.fr)
        s.r.x2.j(0, s.fx)
        s.r.rx.j(0, s.fy)
        s.r.r2.m(0, $.n7(), s)
        s.r.F()
        s.id = $.B()
        p = $.p3()
        q = s.r
        s.go = p + q.dx
        if (q.r2.J(0, $.a7())) {
            q = s.id
            p = $.C()
            s.id = q + p
            s.go = s.go + ($.pq() + s.r.dx * p)
        }
        q = s.r
        q.l = q.l - $.eX()
        q = C.String.B(LangData.get_lang("RCnN"), $.qG())
        p = s.r
        o.push(T.RunUpdate(q, p, p, r, r, 0, 1000, 100))
    },
    aq(a, b, c, d, e) {
        var s = 0
        if (a > s) {
            s = this.go
            if (a <= s) {
                a = $.i()
                this.go = s - (a - a)
            } else {
                a -= s
                this.K(b, e)
            }
            return a
        }
        return s
    },
    at(a, b) {
        var s = this,
            r = s.id - 1
        s.id = r
        if (r === 0) {
            s.K(null, b)
            r = s.r
            r.l = r.l - $.d_()
        }
    },
    ar(a) {
        var s = this.r
        s.H = s.H * $.pe()
    },
    gT() {
        return this.id
    },
    K(a, b) {
        var s, r, q, p = this
        p.fr.D()
        p.fx.D()
        p.fy.D()
        p.r.r2.U(0, $.n7())
        p.r.F()
        s = b.a
        if (a != null) {
            s.push($.K())
            s.push(T.aO(LangData.get_lang("qomn"), a, p.r))
        } else {
            s.push($.K())
            r = LangData.get_lang("GGuN")
            q = p.r
            s.push(T.aO(r, q, q))
        }
        p.go = p.id = 0
    },
    $ix: 1
}
T.dS.prototype = {
    gT() {
        return -$.i()
    },
    at(a, b) {
        var s, r, q, p, o, n = this,
            m = n.x
        if (m.fx > 0) {
            s = n.y
            r = $.i()
            q = n.z
            p = s * (r + (q - r) * $.oX()) / q
            n.y = s - p
            o = C.d.R(p / (m.dx + $.au()))
            b.a.push(T.RunUpdate(LangData.get_lang("nEWa"), n.r, m, null, null, 0, 1000, 100))
            m.aF(o, n.r, T.ad(), a, b)
            m = n.z - 1
            n.z = m
            if (m === 0) n.K(null, b)
        }
    },
    K(a, b) {
        var s, r = this.x
        r.r2.U(0, $.bT())
        this.D()
        if (r.fx > 0) {
            s = b.a
            s.push($.K())
            s.push(T.aO(LangData.get_lang("hIga"), a, r))
        }
    },
    $ix: 1
}
T.SklPoison.prototype = {
    v(a, b, c, d) {
        var s = a[0].a,
            r = T.I(this.r, true, c)
        d.a.push(T.RunUpdate(LangData.get_lang("efnA"), this.r, s, null, null, $.i(), 1000, 100))
        s.a3(r, true, this.r, T.vb(), c, d)
    }
}
T.SklQuake.prototype = {
    gb7() {
        return $.X()
    },
    gb8() {
        return $.a4()
    },
    v(a, b, c, d) {
        var s, r, q, p, o, n = c.n() < 128 ? $.X() : $.C(),
            m = t.j,
            l = H.b([], m),
            k = 0
        while (true) {
            if (!(k < n && k < a.length)) break
            l.push(a[k].a);
            ++k
        }
        s = LangData.get_lang("QQLa")
        r = this.r
        m = H.b(l.slice(0), m)
        q = d.a
        q.push(T.RunUpdate(s, r, null, null, m, $.i(), 1000, 100))
        for (k = 0; k < l.length; ++k) {
            m = T.I(this.r, true, c)
            s = $.px()
            r = l.length
            p = $.p_()
            o = l[k]
            if (o.fx > 0) {
                q.push($.K())
                o.a3(m * s / (r + p), true, this.r, T.ad(), c, d)
            }
        }
    }
}
T.SklRapid.prototype = {
    gb7() {
        return $.B()
    },
    gb8() {
        return $.X()
    },
    v(a, a0, a1, a2) {
        var s, r, q, p, o, n, m, l, k, j, i, h, g = this,
            f = null,
            e = 1000,
            d = a1.n() < 128 ? $.B() : $.t(),
            c = a.length,
            b = $.B()
        if (c > b) a = (a && C.Array).al(a, 0, b)
        for (c = a.length, s = 0; s < c; ++s) a[s].b = $.ao()
        r = 0
        for (c = a2.a, q = r; q < d; ++q) {
            b = g.r
            p = b.fx
            o = 0
            if (!(p > o && !b.A)) return
            n = a[r]
            p = n.a
            if (p.fx <= o) q -= $.b0()
            else {
                b = T.I(b, false, a1)
                o = $.mI()
                m = n.b
                l = $.oY()
                n.b = m + 1
                if (q === 0) {
                    k = LangData.get_lang("yGEA")
                    j = g.r
                    i = new T.aX(0, e, 100, k, j, p, f, f)
                    i.aK(k, j, p, f, f, 0, e, 100)
                    c.push(i)
                } else {
                    k = LangData.get_lang("dRsa")
                    j = g.r
                    i = $.i()
                    h = new T.aX(i, e, 100, k, j, p, f, f)
                    h.aK(k, j, p, f, f, i, e, 100)
                    c.push(h)
                }
                if (p.a3(b * (o - m * l), false, g.r, T.ad(), a1, a2) <= 0) return
                c.push($.K())
            }
            r = C.JsInt.V(r + (a1.n() & 3), a.length)
        }
    }
}
T.SklRevive.prototype = {
    b9(a) {
        return a.b5(this.r.z.e)
    },
    as(a, b) {
        return a.fx <= 0 && !(a instanceof T.aM) && !a.r2.J(0, $.iJ())
    },
    a9(a, b, c) {
        var s
        if (b) {
            s = a.M
            s.toString
            return s
        }
        return c.gbo()
    },
    v(a, b, c, d) {
        var s, r, q, p, o, n, m, l = this,
            k = null
        l.f = C.JsInt.P(l.f + $.i(), $.t())
        s = a[0].a
        r = C.d.R(T.I(l.r, true, c) / $.pZ())
        q = s.fy
        if (r > q) r = q
        p = d.a
        p.push(T.RunUpdate(LangData.get_lang("FXSa"), l.r, s, k, k, $.i(), 1000, 100))
        p.push(T.RunUpdate(C.String.B(LangData.get_lang("rFJa"), $.ng()), l.r, s, k, k, r + $.a6(), 1000, 100))
        s.fx = r
        o = s.y
        if (!C.Array.w(o.f, s)) {
            n = o.a
            if (!C.Array.w(n.c, s)) C.Array.j(n.c, s)
            n = n.e
            if (!C.Array.w(n, s)) {
                m = o.f
                if (m.length > 0) C.Array.co(n, C.Array.aT(n, C.Array.gbl(m)) + $.i(), s)
                else n.push(s)
            }
            C.Array.j(o.f, s)
        }
        o = LangData.get_lang("imin")
        n = l.r
        m = new T.HPlr(0)
        m.a = s.e
        m.d = s.fx
        p.push(T.RunUpdate(o, n, m, new T.HRecover(r), k, 0, 1000, 100))
    }
}
T.hu.prototype = {
    ao(a, b) {
        this.r = a
        this.f = C.JsInt.P(b, $.t()) + $.mU()
    },
    v(a, b, c, d) {
        var s, r, q, p = this,
            o = null,
            n = a[0].a,
            m = d.a
        m.push(T.RunUpdate(LangData.get_lang("dxVA"), p.r, n, o, o, 0, 1000, 100))
        if (!n.a7($.aJ(), c)) s = n.fx > 0 && !n.A && T.bW(p.r.dx, n.dy, c)
        else s = true
        if (s) {
            // dodge (通用回避)
            // [0][回避]了攻击
            m.push(T.RunUpdate(LangData.get_lang("BtqN"), n, p.r, o, o, $.as(), 1000, 100))
            return
        }
        r = t.aJ.a(n.r2.h(0, $.aJ()))
        if (r == null) {
            r = T.nC(n)
            r.fr = $.C()
            r.aP(0)
        } else r.fr = r.fr + $.C()
        m.push(T.RunUpdate(C.String.B(LangData.get_lang("jIRA"), $.nc()), p.r, n, o, o, 0, 1000, 100))
        m = p.r
        q = m.fx
        m.fx = 0
        m.bm(q, o, c, d)
    }
}
T.PlrShadow.prototype = {
    gap() {
        return this.aj.r
    },
    ac() {
        this.k3 = T.SklAttack(this)
        this.k1.push(new T.hu(0))
    },
    aU() {
        var s, r
        this.bB()
        s = this.q
        r = $.ap()
        s[r] = C.d.P(s[r], $.t())
    }
}
T.SklShadow.prototype = {
    au(a, b) {
        if (b)
            if (this.r.fx < $.b3()) return false
        return this.aX(a, b)
    },
    aa(a, b, c) {
        return H.b([], t.F)
    },

    v(a7, a8, a9, b0) {
        var s, shadow_name, q, p, o, n, m, l, k, j, i, h, g, f, e, d, c, b, a, a0, a1, a2, a3, a4, this_ = this,
            a6 = null
        this_.f = C.d.R(this_.f * $.mI())
        s = b0.a
        s.push(T.RunUpdate(LangData.get_lang("USvA"), this_.r, a6, a6, a6, $.a6(), 1000, 100))
        shadow_name = H.as_string(this_.r.a) + "?" + H.as_string($.qM())
        // r = name + "?" + "shadow"
        // console.log("T.hB.v", shadow_name, a5.r.a, H.e($.qM()))
        q = this_.r
        p = q.b
        q = q.c
        o = 0
        n = $.T()
        m = H.b([], t.q)
        l = H.b([], t.H)
        k = P.a0(t.X, t.W)
        j = new Sgls.c(t.n)
        j.c = j
        j.b = j
        i = new Sgls.c(t.p)
        i.c = i
        i.b = i
        h = new Sgls.c(t.g)
        h.c = h
        h.b = h
        g = new Sgls.c(t.G)
        g.c = g
        g.b = g
        f = new Sgls.c(t._)
        f.c = f
        f.b = f
        e = new Sgls.c(t.e)
        e.c = e
        e.b = e
        d = new Sgls.c(t.k)
        d.c = d
        d.b = d
        c = new Sgls.c(t.l)
        c.c = c
        c.b = c
        b = new Sgls.c(t.m)
        b.c = b
        b.b = b
        a = t.i
        a0 = H.b([], a)
        a1 = H.b([], a)
        a2 = H.b([], a)
        a = H.b([], a)
        a3 = 0
        a4 = new T.PlrShadow(shadow_name, p, q, a6, o, n, m, l, k, j, i, h, g, f, e, d, c, b, a0, a1, a2, a, a3, a3, a3, $.W(), a3)
        a4.a1(shadow_name, p, q, a6)
        a4.a6 = new T.cp(a4)
        a4.aj = this_
        a4.e = T.fD(this_.r)
        a4.r = LangData.get_lang("VdSN")
        q = this_.r
        a4.y = q.y
        q.L.j(0, a4.a6)
        a4.az()
        if (this_.r.r2.J(0, $.a7())) a4.l = $.bx()
        else a4.l = -$.bx()
        this_.r.y.aZ(a4)
        shadow_name = LangData.get_lang("wHun")
        q = this_.r
        p = a4.fx
        o = new T.HPlr(p)
        o.a = a4.e
        o.d = p
        s.push(T.RunUpdate(shadow_name, q, o, a6, a6, 0, 1000, 100))
    }
}
T.eh.prototype = {
    gT() {
        return -$.i()
    },
    ar(a) {
        var s = this.x
        s.cy = C.JsInt.P(s.cy, $.t())
    },
    at(a, b) {
        var s = this.z - 1
        this.z = s
        if (s === 0) this.K(null, b)
    },
    K(a, b) {
        var s, r
        this.D()
        s = this.x
        s.r2.U(0, $.bi())
        this.y.D()
        s.F()
        if (s.fx > 0) {
            r = b.a
            r.push($.K())
            r.push(T.aO(LangData.get_lang("EJLN"), a, s))
        }
    },
    $ix: 1
}
T.SklSlow.prototype = {
    as(a, b) {
        var s
        if (b) {
            if (!(a.fx < $.b3())) {
                s = a.r2
                s = s.J(0, $.bi()) && t.S.a(s.h(0, $.bi())).z > $.i()
            } else s = true
            if (s) return false
        }
        return true
    },
    a9(a, b, c) {
        var s = this.bZ(a, b, c, true)
        return a.r2.h(0, $.bi()) != null ? s / $.t() : s
    },
    v(a, b, c, d) {
        var s, r, q = this,
            p = null,
            o = a[0].a,
            n = d.a
        n.push(T.RunUpdate(LangData.get_lang("hdla"), q.r, o, p, p, $.i(), 1000, 100))
        if (!o.a7($.bi(), c)) s = o.fx > 0 && !o.A && T.bW(q.r.dx, o.dy, c)
        else s = true
        if (s) {
            // dodge (通用回避)
            // [0][回避]了攻击
            n.push(T.RunUpdate(LangData.get_lang("BtqN"), o, q.r, p, p, $.as(), 1000, 100))
            return
        }
        o.l = o.l - (o.cy + $.au())
        s = o.r2
        r = t.S.a(s.h(0, $.bi()))
        if (r == null) {
            r = new T.eh(o, $.t())
            r.y = new T.b8(r)
            s.m(0, $.bi(), r)
            o.rx.j(0, r)
            o.x2.j(0, r.y)
            o.F()
        } else r.z = r.z + $.t()
        if (q.r.r2.J(0, $.a7())) r.z = r.z + $.C()
        n.push(T.RunUpdate(C.String.B(LangData.get_lang("YNva"), $.qJ()), q.r, o, p, p, $.a6(), 1000, 100))
    }
}
T.hj.prototype = {
    v(a, b, c, d) {
        var s, r, q, p, o, n = this,
            m = a[0].a,
            l = t.a.a(m.r2.h(0, $.eY()))
        if (l == null) l = new T.c3($.ao())
        s = T.I(n.r, true, c)
        r = $.mZ()
        q = l.b
        d.a.push(T.RunUpdate(LangData.get_lang("Ycen"), n.r, m, null, null, 0, 1000, 100))
        p = n.r
        o = p.fx
        p.fx = 0
        m.a3(s * (r + q), true, p, T.oJ(), c, d)
        n.r.bm(o, null, c, d)
    }
}
T.PlrSummon.prototype = {
    gap() {
        return this.aj.r
    },
    aU() {
        var s, r, q, p
        this.bB()
        s = this.q
        r = $.ap()
        s[r] = C.d.P(s[r], $.B())
        r = 0
        s[r] = r
        q = $.i()
        p = this.aj.r.q
        s[q] = p[q]
        s[$.C()] = r
        r = $.X()
        s[r] = p[r]
    },
    ac() {
        this.k3 = T.SklAttack(this)
        var s = this.k1
        s.push(new T.SklFire(0))
        s.push(new T.SklFire(0))
        s.push(new T.hj(0))
    },
    bP() {
        var s, r = this
        r.dS()
        s = r.bi
        if (s == null) s = r.bi = new T.cA(r)
        r.G.j(0, s)
    },
    aD(a, b, c, d) {
        this.aR = true
        this.aj.r.aF(C.JsInt.P(a, $.t()), b, T.ad(), c, d)
        this.aR = false
    },
    b1(a, b, c, d) {
        var s = this,
            r = s.fx,
            q = 0
        if (r > q) {
            s.fx = q
            if (!s.aR) s.bm(r, null, c, d)
        }
        s.a6.D()
        return false
    }
}
T.SklSummon.prototype = {
    au(a, b) {
        var s
        if (b)
            if (this.r.fx < $.b3()) return false
        s = this.fr
        return (s == null || s.fx <= 0) && this.aX(a, b)
    },
    aa(a, b, c) {
        return H.b([], t.F)
    },
    v(a6, a7, a8, a9) {
        var s, r, q, p, o, n, m, l, k, j, i, h, g, f, e, d, c, b, a, a0, a1, a2, this_ = this,
            a4 = null,
            a5 = a9.a
        a5.push(T.RunUpdate(LangData.get_lang("sCza"), this_.r, a4, a4, a4, $.a6(), 1000, 100))
        s = this_.fr
        if (s == null) {
            s = H.as_string(this_.r.a) + "?" + H.as_string($.qQ())
            r = this_.r
            q = r.b
            r = r.c
            p = 0
            o = $.T()
            n = H.b([], t.q)
            m = H.b([], t.H)
            l = P.a0(t.X, t.W)
            k = new Sgls.c(t.n)
            k.c = k
            k.b = k
            j = new Sgls.c(t.p)
            j.c = j
            j.b = j
            i = new Sgls.c(t.g)
            i.c = i
            i.b = i
            h = new Sgls.c(t.G)
            h.c = h
            h.b = h
            g = new Sgls.c(t._)
            g.c = g
            g.b = g
            f = new Sgls.c(t.e)
            f.c = f
            f.b = f
            e = new Sgls.c(t.k)
            e.c = e
            e.b = e
            d = new Sgls.c(t.l)
            d.c = d
            d.b = d
            c = new Sgls.c(t.m)
            c.c = c
            c.b = c
            b = t.i
            a = H.b([], b)
            a0 = H.b([], b)
            a1 = H.b([], b)
            b = H.b([], b)
            a2 = 0
            a2 = new T.PlrSummon(s, q, r, a4, p, o, n, m, l, k, j, i, h, g, f, e, d, c, a, a0, a1, b, a2, a2, a2, $.W(), a2)
            a2.a1(s, q, r, a4)
            a2.a6 = new T.cp(a2)
            a2.aj = this_
            a2.e = T.fD(this_.r)
            this_.fr = a2
            // sklSummonName
            a2.r = LangData.get_lang("DxYn") // 使魔
            a2 = this_.fr
            a2.y = this_.r.y
            a2.az()
        } else {
            s.bP()
            s.bs()
            s.cn()
        }
        this_.r.L.j(0, this_.fr.a6)
        // this_.fr.l = a8.n() * $.C()
        this_.fr.l = a8.n() * 4
        if (this_.r.r2.J(0, $.a7())) {
            this_.fr.bi.D()
            this_.fr.l = $.bx()
        }
        this_.r.y.aZ(this_.fr)
        // sklSummoned
        s = LangData.get_lang("qhOn") // 召唤出[1]
        r = this_.r
        q = this_.fr
        p = q.fx
        o = new T.HPlr(p)
        o.a = q.e
        o.d = p
        a5.push(T.RunUpdate(s, r, o, a4, a4, 0, 1000, 100))
    }
}
T.SklThunder.prototype = {
    v(a, b, c, d) {
        var s, r, q, p, o, n, m, l, k = this,
            j = null,
            i = 1000,
            h = a[0].a,
            g = d.a
        g.push(T.RunUpdate(LangData.get_lang("hyoA"), k.r, h, j, j, $.i(), i, 100))
        s = $.B() + (c.n() & 3)
        r = $.ci() + k.r.db
        for (q = 0, p = q, o = false; q < s; ++q) {
            n = k.r
            if (n.fx > p && !n.A && h.fx > p) {
                g.push($.K())
                if (h.fx > 0 && !h.A && T.bW(r, h.dy + h.db, c)) {
                    if (o) {
                        p = LangData.get_lang("EORN")
                        n = k.r
                        m = new T.aX(0, i, 100, p, h, n, j, j)
                        m.aK(p, h, n, j, j, 0, i, 100)
                        g.push(m)
                    } else {
                        // dodge (通用回避)
                        // [0][回避]了攻击
                        p = LangData.get_lang("BtqN")
                        n = k.r
                        m = new T.aX(0, i, 100, p, h, n, j, j)
                        m.aK(p, h, n, j, j, 0, i, 100)
                        g.push(m)
                    }
                    return
                }
                r -= $.Z()
                p = T.I(k.r, true, c)
                n = $.oZ()
                l = g.length
                m = k.r
                m = h.aF(h.aq(C.d.R(p * n / T.d9(h, true, c)), m, T.ad(), c, d), m, T.ad(), c, d)
                n = 0
                if (m > n) o = true
                g[l].b = $.mR()
                p = n
            }
        }
    }
}
T.f5.prototype = {
    gan() {
        var s = $.bg()
        return H.b([s, $.lI(), s, $.Z(), $.lK(), $.C(), s, $.q5()], t.i)
    },
    ac() {
        var s, r
        this.k3 = T.SklAttack(this)
        s = this.k1
        s.push(new T.h6(0))
        r = new T.e2(0)
        r.f = $.pW()
        s.push(r)
        r = new T.SklIce(0)
        r.f = $.b3()
        s.push(r)
    }
}
T.h6.prototype = {
    aq(a, b, c, d, e) {
        // if (a > 0 && J.Y(c, T.mE())) {
        if (a > 0 && (c === T.mE())) {
            e.a.push(T.RunUpdate(LangData.get_lang("HwtN"), this.r, null, null, null, a, 1000, 100))
            return -a
        }
        // return a > 0 && J.Y(c, T.oH()) ? 0 : a
        return a > 0 && (c === T.oH()) ? 0 : a
    },
    W() {
        this.r.y2.j(0, this)
    },
    $iaB: 1
}
T.e2.prototype = {
    gb7() {
        return $.X()
    },
    gb8() {
        return $.a4()
    },
    v(a, b, c, d) {
        var s, r, q, p, o, n, m = t.j,
            l = H.b([], m)
        for (s = 0; s < a.length; ++s) l.push(a[s].a)
        r = LangData.get_lang("PRrA")
        q = this.r
        m = H.b(l.slice(0), m)
        p = d.a
        p.push(T.RunUpdate(r, q, null, null, m, $.i(), 1000, 100))
        o = T.I(this.r, true, c) * $.mQ() / (l.length + $.b0())
        for (s = 0; s < l.length; ++s) {
            n = l[s]
            if (n.fx > 0) {
                p.push($.K())
                n.a3(o, true, this.r, T.mE(), c, d)
            }
        }
    }
}
T.fP.prototype = {
    e1(a, b, c, d) {
        var s, r, q, p, o = this
        for (s = $.a4(), r = o.a6; s < $.b1(); ++s) {
            q = o.t
            p = (q[s] | $.at()) >>> 0
            q[s] = p
            q[s] = p + r
        }
        for (s = $.p6(); s < $.aR(); ++s) {
            q = o.t
            q[s] = q[s] + r
        }
        for (s = $.mO(); s < $.iI(); ++s) {
            q = o.t
            q[s] = q[s] + r
        }
        for (s = $.au(); s < $.d_(); ++s) {
            q = o.t
            p = (q[s] | $.aR()) >>> 0
            q[s] = p
            q[s] = p + r
        }
    },
    a7(a, b) {
        return (b.n() & 127) < this.a6
    }
}
T.PlrBossTest.prototype = {
    e4(a, b, c) {
        var s, r, q
        for (s = 0; s < $.b1(); ++s) {
            r = this.t
            q = r[s]
            if (q < $.cY()) r[s] = $.b2() - q
        }
    },
    bf() {
        this.x = $.ao()
    }
}
T.PlrBossTest2.prototype = {
    e5(a, b) {
        var s, r, q
        for (s = 0; s < $.b1(); ++s) {
            r = this.t
            q = r[s]
            if (q < $.at()) r[s] = $.b2() - q
        }
    },
    bf() {
        this.x = $.ao()
    }
}
T.fQ.prototype = {
    e2(a, b, c, d) {
        var s, r, q, p, o, n = this
        for (s = $.a4(); r = $.b1(), s < r; ++s) {
            q = n.t
            p = q[s]
            o = $.mV()
            if (p < o) q[s] = ((p & $.eT()) >>> 0) + o
        }
        for (s = r; s < $.d_(); ++s) {
            q = n.t
            p = q[s]
            if (p < $.aR()) q[s] = p + $.at()
        }
        q = H.b([], t.i)
        C.Array.a5(q, n.t)
        n.E = q
    },
    cA(a) { },
    bf() {
        this.x = $.ao()
    }
}
T.cz.prototype = {
    av(a, b) {
        LangData.get_lang(LangData.eQ(H.as_string($.n4()) + H.as_string(a)))
        this.r = LangData.get_lang(LangData.eQ(H.as_string($.n4()) + H.as_string(a)))
    },
    gan() {
        return null
    },
    aU() {
        var s, r, q = this
        q.bB()
        if (q.gan() != null)
            for (s = 0; r = q.q, s < r.length; ++s) r[s] = r[s] + q.gan()[s]
    },
    dm(a, b) {
        var s, r, q
        for (s = 0, r = this.k1; s < r.length; ++s) {
            q = r[s]
            q.ao(this, q.f)
        }
    },
    bs() {
        var s, r, q, p
        for (s = 0, r = this.k1, q = this.k4; s < r.length; ++s) {
            p = r[s]
            if (p instanceof T.ActionSkill) q.push(p)
        }
        for (s = 0; s < r.length; ++s) r[s].W()
    },
    cE() {
        // return $.iK()
        return "??"
    },
    gaS() {
        return []
    },
    gaG() {
        return H.b([$.d2(), $.aE(), $.aJ(), $.eZ(), $.bh(), $.d3(), $.bi(), $.bS()], t.V)
    },
    a7(a, b) {
        if (C.Array.w(this.gaS(), a)) return b.n() < 240
        if (C.Array.w(this.gaG(), a)) return b.n() < 192
        return b.n() < 84
    }
}
T.f6.prototype = {
    gan() {
        var s = 0
        return H.b([s, $.aI(), -$.mT(), $.as(), s, $.mV(), $.lI(), $.po()], t.i)
    },
    gaS() {
        return H.b([$.aE()], t.V)
    },
    ac() {
        var s = new T.hb(this, -$.i(), 0)
        s.r = this
        this.k3 = s
    }
}
T.hb.prototype = {
    gb7() {
        return $.B()
    },
    gb8() {
        return $.C()
    },
    as(a, b) {
        return !(a instanceof T.aM)
    },
    v(a, b, c, d) {
        var s, r, q, p, o, n, m = this,
            l = null,
            k = 1000
        for (; a == null;) a = m.aa(0, true, c)
        s = a[0].a
        r = m.fx
        q = $.i()
        if (r === -q && a.length === q) {
            m.fx = q
            r = d.a
            r.push(T.RunUpdate(LangData.get_lang("uMZa"), m.r, l, l, l, 0, k, 100))
            r.push($.K())
        }
        r = m.fx
        q = 0
        if (r > q) {
            m.fx = r - 1
            d.a.push(T.RunUpdate(LangData.get_lang("Gikn"), m.r, l, l, l, 0, k, 100))
            return
        }
        p = s.fx
        s.fx = q
        o = a.length
        n = $.i()
        r = o === n && r === q
        q = d.a
        if (r) {
            q.push(T.RunUpdate(LangData.get_lang("dEsa"), m.r, l, l, l, 0, k, 100))
            q.push(T.RunUpdate(LangData.get_lang("RmQa"), m.r, l, l, l, l, $.eS(), $.lH()))
            q.push(T.RunUpdate(LangData.get_lang("imLn"), m.r, l, l, l, 0, k, 100))
            r = LangData.get_lang("woia")
            o = m.r
            n = new T.HPlr(p)
            n.a = s.e
            n.d = s.fx
            q.push(T.RunUpdate(r, o, n, new T.HDamage(p), l, p + $.b3(), k, 100))
        } else {
            m.fx = n
            r = LangData.get_lang("MtDN")
            o = m.r
            n = new T.HPlr(p)
            n.a = s.e
            n.d = s.fx
            q.push(T.RunUpdate(r, o, n, new T.HDamage(p), l, p + $.b3(), k, 100))
        }
        s.bm(p, m.r, c, d)
        r = m.r
        q = r.l + s.y.f.length * $.eS()
        r.l = q
        o = $.lJ()
        if (q > o) r.l = o
    }
}
T.PlrBossCovid.prototype = {
    gan() {
        var s = $.Z(),
            r = $.n2(),
            q = 0,
            p = $.cY()
        return H.b([s, r, q, p, q, p, q, $.a6()], t.i)
    },
    gaG() {
        return H.b([$.aE(), $.aJ(), $.d3()], t.V)
    },
    ac() {
        var s = 0
        this.k3 = new T.hd(this, s)
        this.k1.push(new T.he(s))
    }
}
T.dk.prototype = {
    gT() {
        return 0
    },
    K(a, b) { },
    $ix: 1
}
T.dl.prototype = {
    at(a, b) {
        var s, r, q, p, o, n, m, l = this,
            k = l.fx
        if (k.fx > 0 && l.fy > $.i()) {
            s = C.d.R((T.I(k, true, a) + l.go * $.b3()) / T.d9(k, true, a))
            r = l.fr
            q = b.a
            q.push(T.RunUpdate(LangData.get_lang("VZaN"), r, k, null, null, 0, 1000, 100))
            p = k.aF(s, r, T.ad(), a, b)
            o = 0
            if (p > o && r.fx > o) {
                o = $.i()
                n = C.JsInt.am(s, o)
                m = r.fx
                if (m >= r.fy) n = C.JsInt.d5(n, $.t()) + o
                if (n > p) n = p
                r.fx = m + n
                o = LangData.get_lang("imin")
                m = new T.HPlr(m)
                m.a = r.e
                m.d = r.fx
                q.push(T.RunUpdate(o, r, m, new T.HRecover(n), null, 0, 1000, 100))
            }
        }
        if (l.fy > $.a4()) {
            l.D()
            l.id.b = true
            l.k1.D()
            l.k2.D()
            k.F()
        }
    },
    v(a, b, c, d) {
        var s, r, q, p, o, n, m, l, k = this,
            j = null,
            i = 1000
        if (k.fy == 0 || c.n() > k.fx.fr) {
            k.fy = k.fy + (c.n() & 3)
            for (s = 0, r = k.fx, q = k.fr, p = t.cu; s < $.X(); ++s) {
                o = c.b5(q.y.a.e)
                if (o !== r && o != q) {
                    n = p.a(o.r2.h(0, $.ck()))
                    if (n != null) {
                        m = k.go
                        m = !n.c.w(0, m)
                    } else m = true
                    if (m) {
                        if (o.y == r.y) k.fH(o, c, d)
                        else {
                            l = T.I(r, false, c)
                            p = LangData.get_lang("EYAn")
                            m = new T.aX(0, i, 100, p, r, o, j, j)
                            m.aK(p, r, o, j, j, 0, i, 100)
                            d.a.push(m)
                            o.a3(l, false, q, k.gf9(), c, d)
                        }
                        return
                    }
                }
            }
        }
        r = k.fy + (c.n() & 3)
        k.fy = r
        q = k.fr
        p = k.fx
        m = d.a
        if (r > $.t()) m.push(T.RunUpdate(LangData.get_lang("Ojba"), q, p, j, j, 0, i, 100))
        else m.push(T.RunUpdate(LangData.get_lang("JBrN"), q, p, j, j, 0, i, 100))
    },
    fH(a, b, c) {
        var s, r = null,
            q = this.fx,
            p = c.a
        p.push(T.RunUpdate(LangData.get_lang("UFQa"), q, a, r, r, 0, 1000, 100))
        s = a.fr
        s = T.oq(a) ? s + $.pd() : C.JsInt.am(s, $.i())
        if (b.n() < s) {
            p.push(T.RunUpdate(LangData.get_lang("kloA"), q, a, r, r, 0, 1000, 100))
            return false
        } else return T.j7(this.fr, a, this.go, b, c)
    },
    fa(a, b, c, d, e) {
        T.j7(this.fr, b, this.go, d, e)
    },
    aN(a, b, c, d) {
        var s
        if (c.n() < 64) {
            s = c.n() & 127
            this.go = s
            this.id.c.j(0, s)
        }
        return this
    },
    gap() {
        return this.fr
    }
}
T.he.prototype = {
    W() {
        this.r.G.j(0, this)
    },
    aD(a, b, c, d) {
        if (b.r2.h(0, $.ck()) == null) {
            if (T.oq(b) && c.n() < 192) return
            T.j7(this.r, b, $.bg(), c, d)
        }
    },
    $iah: 1
}
T.hd.prototype = {
    v(a, b, c, d) {
        var s = a[0].a,
            r = this.fr,
            q = T.I(r, false, c)
        d.a.push(T.RunUpdate(LangData.get_lang("EYAn"), r, s, null, null, 0, 1000, 100))
        s.a3(q, false, r, T.v8(), c, d)
    },
    gap() {
        return this.fr
    }
}
T.f8.prototype = {
    gan() {
        return H.b([$.aI(), $.iI(), $.mN(), $.mW(), $.Z(), $.mL(), $.mT(), $.mJ()], t.i)
    },
    gaG() {
        return H.b([$.d2(), $.eZ(), $.d3(), $.bT(), $.bi(), $.bS()], t.V)
    },
    a7(a, b) {
        if (a == $.bh()) return false
        return this.cM(a, b)
    },
    ac() {
        var s, r
        this.k3 = T.SklAttack(this)
        s = this.k1
        s.push(new T.hn(0))
        r = new T.hm(0)
        r.f = $.aI()
        s.push(r)
    }
}
T.hn.prototype = {
    ga4() {
        return $.pk()
    },
    aq(a, b, c, d, e) {
        var s
        if (a > 0) {
            s = $.i()
            s = (a & s) >>> 0 === s
        } else s = false
        if (s) {
            e.a.push(T.RunUpdate(LangData.get_lang("iOkN"), this.r, null, null, null, a, 1000, 100))
            return -a
        }
        return a
    },
    W() {
        this.r.y2.j(0, this)
    },
    $iaB: 1
}
T.hm.prototype = {
    gb7() {
        return $.X()
    },
    gb8() {
        return $.a4()
    },
    v(a, b, c, d) {
        var s, r, q, p, o, n, m = t.j,
            l = H.b([], m)
        for (s = 0; s < a.length; ++s) l.push(a[s].a)
        r = LangData.get_lang("UeNa")
        q = this.r
        m = H.b(l.slice(0), m)
        p = d.a
        p.push(T.RunUpdate(r, q, null, null, m, $.i(), 1000, 100))
        o = T.I(this.r, true, c) * $.mQ() / (l.length + $.b0())
        for (s = 0; s < l.length; ++s) {
            n = l[s]
            if (n.fx > 0) {
                p.push($.K())
                m = this.r
                n.aF(n.aq(C.d.R(o / T.d9(n, true, c)), m, T.ad(), c, d), m, T.ad(), c, d)
            }
        }
    }
}
T.de.prototype = {
    gan() {
        var s = 0
        return H.b([s, $.q2(), $.Z(), -$.as(), s, $.b1(), s, $.cZ()], t.i)
    },
    gaG() {
        return H.b([$.d2(), $.eZ(), $.bh(), $.d3()], t.V)
    },
    ac() {
        var s = $.T(),
            r = 0
        this.k3 = new T.hp(this, s, r)
        this.k1.push(new T.hq(r))
    }
}
T.dB.prototype = {
    gT() {
        return 0
    },
    ar(a) {
        var s = this.fx
        s.cy = C.JsInt.P(s.cy, $.t())
    },
    at(a, b) {
        var s, r, q = this.fx
        if (q.fx > 0) {
            s = this.fr
            r = C.d.R(T.I(s, true, a) / T.d9(q, true, a))
            b.a.push(T.RunUpdate(LangData.get_lang("sPnN"), s, q, null, null, 0, 1000, 100))
            q.aF(r, s, T.ad(), a, b)
        }
    },
    aP(a) {
        var s = this,
            r = s.fx
        r.r2.m(0, $.d5(), s)
        r.rx.j(0, s.go)
        r.x2.j(0, s.fy)
        r.x1.j(0, s.id)
        r.F()
    },
    K(a, b) {
        var s, r = this
        r.D()
        s = r.fx
        s.r2.U(0, $.d5())
        r.fy.D()
        r.id.D()
        r.go.D()
        s.F()
    },
    v(a, b, c, d) {
        T.nP(this.fx, c, d)
    },
    aN(a, b, c, d) {
        if (c.n() < 128) return this
        return a
    },
    $ix: 1,
    gap() {
        return this.fr
    }
}
T.hq.prototype = {
    W() {
        this.r.G.j(0, this)
    },
    aD(a, b, c, d) {
        if (t.r.a(b.r2.h(0, $.d5())) == null) {
            T.nO(this.r, b).aP(0)
            d.a.push(T.RunUpdate(LangData.get_lang("JnTA"), this.r, b, null, null, 0, 1000, 100))
        }
    },
    $iah: 1
}
T.hp.prototype = {
    v(a, b, c, d) {
        var s, r, q, p = this,
            o = a[0].a
        if (t.r.a(o.r2.h(0, $.d5())) != null && c.n() < 128) {
            T.nP(p.fr, c, d)
            p.fx = p.fx + $.b0()
            return
        }
        s = p.fr
        r = T.I(s, false, c)
        q = p.fx
        d.a.push(T.RunUpdate(LangData.get_lang("EYAn"), s, o, null, null, 0, 1000, 100))
        if (o.a3(r * q, false, s, T.va(), c, d) > 0) p.fx = $.T()
    },
    gap() {
        return this.fr
    }
}
T.df.prototype = {
    gan() {
        return H.b([0, $.lL(), $.d1(), $.mX(), $.iI(), $.iH(), $.eT(), $.n0()], t.i)
    },
    F() {
        var s = this
        s.dT()
        if (s.aC > 0) s.id = s.id * $.mM()
    },
    gaS() {
        return []
    },
    gaG() {
        return H.b([$.d2()], t.V)
    },
    a7(a, b) {
        if (a == $.lP()) return false
        return this.cM(a, b)
    },
    ac() {
        var s, r, q = this
        q.k3 = T.hE(q)
        s = 0
        q.aj = new T.SklFire(s)
        s = new T.hr(q, s)
        s.r = q
        s.f = $.b2()
        q.bi = s
        r = q.k1
        r.push(s)
        r.push(q.aj)
        s = T.tH(q, $.B())
        q.aR = s
        r.push(s)
    }
}
T.hr.prototype = {
    gT() {
        return $.i()
    },
    ao(a, b) { },
    au(a, b) {
        var s = this.fr,
            r = s.aC,
            q = $.t()
        if (r >= q) {
            if (s.aR.Q >= q) return false
            return a.n() < $.ap()
        }
        return a.n() < 128
    },
    aa(a, b, c) {
        return H.b([], t.F)
    },
    v(a, b, c, d) {
        var s, r, q = this,
            p = null,
            o = 1000,
            n = q.fr
        n.r2.m(0, $.lQ(), q)
        s = n.aC = n.aC + 1
        if (s === $.i()) {
            s = d.a
            s.push(T.RunUpdate(LangData.get_lang("iRhA"), q.r, p, p, p, 0, o, 100))
            n.F()
            s.push(T.RunUpdate(LangData.get_lang("zqHn"), q.r, p, p, p, 0, o, 100))
        } else {
            r = d.a
            if (s === $.t()) {
                r.push(T.RunUpdate(LangData.get_lang("LJOA"), q.r, p, p, p, 0, o, 100))
                n.aj.f = $.cZ()
                r.push(T.RunUpdate(LangData.get_lang("cZhN"), q.r, p, p, p, 0, o, 100))
            } else {
                r.push(T.RunUpdate(LangData.get_lang("ovXA"), q.r, p, p, p, 0, o, 100))
                s = n.aR
                s.Q = s.Q + 1
                r.push(T.RunUpdate(LangData.get_lang("FshN"), q.r, p, n.aR.Q, p, 0, o, 100))
            }
        }
        n.l = n.l + $.lH()
    },
    K(a, b) {
        var s = this.fr
        s.r2.U(0, $.lQ())
        s.aC = s.aj.f = 0
        s.F()
    },
    $ix: 1
}
T.ea.prototype = {
    ga4() {
        return $.lG()
    },
    ao(a, b) { },
    b1(a, b, c, d) {
        var s, r, q = this,
            p = null,
            o = q.Q - 1
        q.Q = o
        if (o > 0) {
            q.r.bL(p, d)
            q.dA(0, d)
            o = LangData.get_lang("IUIN")
            s = q.r
            r = new T.HPlr(0)
            r.a = s.e
            r.d = s.fx
            r = T.RunUpdate(o, r, p, p, p, 0, 1000, 100)
            r.b = $.lJ()
            o = d.a
            o.push(r)
            o.push(T.RunUpdate(LangData.get_lang("FshN"), q.r, p, q.Q, p, 0, 1000, 100))
            q.dd(c, d)
            return true
        }
        return false
    },
    dA(a, b) {
        var s = this.r
        s.fx = s.fy
        t.ch.a(s).bi.K(null, b)
    },
    dd(a, b) { },
    W() {
        this.r.L.j(0, this)
    },
    $iaF: 1
}
T.f9.prototype = {
    gan() {
        return H.b([-$.B(), $.eW(), $.pv(), $.pY(), $.X(), $.ap(), $.cY(), -$.lK()], t.i)
    },
    gaS() {
        return H.b([$.d2(), $.lP()], t.V)
    },
    gaG() {
        return H.b([$.aJ(), $.aE()], t.V)
    },
    ac() {
        this.k3 = T.hE(this)
        var s = new T.SklAbsorb(0)
        s.f = $.ci()
        this.k1.push(s)
    }
}
T.fa.prototype = {
    gan() {
        return H.b([$.pX(), $.pI(), $.n0(), $.q_(), $.pV(), $.pU(), 0, $.q1()], t.i)
    },
    gaS() {
        return H.b([$.eZ(), $.d3()], t.V)
    },
    gaG() {
        return H.b([$.aJ(), $.bi(), $.bS()], t.V)
    },
    ac() {
        var s = 0,
            r = t.cr
        r = new T.hA(s, s, P.c5(r), P.c5(r), 0)
        r.id = new T.dT(1 / 0, r)
        this.k3 = r
        this.k1.push(r)
    }
}
T.hA.prototype = {
    W() {
        this.r.y2.j(0, this.id)
    },
    v(a, b, c, d) {
        var s, r, q, p, o = this,
            n = null
        if (o.fx / (o.fy.a + o.go.a / $.B() + $.i()) > $.mP()) {
            s = d.a
            s.push(T.RunUpdate(LangData.get_lang("dlfA"), o.r, n, n, n, n, $.eS(), $.lH()))
            s.push($.K())
            s.push(T.RunUpdate(LangData.get_lang("tHLa"), o.r, n, n, n, 0, 1000, 100))
            s = o.r
            s.y.dj(s)
            return
        }
        s = o.fr
        if (s < $.Z()) {
            o.fr = s + 1
            return
        }
        r = a[0].a
        s = T.I(o.r, false, c)
        q = $.cY()
        d.a.push(T.RunUpdate(LangData.get_lang("EYAn"), o.r, r, n, n, 0, 1000, 100))
        r.a3(s * q, false, o.r, T.ad(), c, d)
        for (s = o.r.y.a.e, q = s.length, p = 0; p < q; ++p) s[p].l = 0
        o.r.l = $.pb()
    },
    aq(a, b, c, d, e) {
        var s = this,
            r = s.fy
        if (t.fM.b(b)) {
            r.j(0, b.gap())
            s.go.j(0, b)
        } else r.j(0, b)
        s.fx = s.fx + a
        return C.JsInt.P(a, $.ci())
    }
}
T.cy.prototype = {}
T.fR.prototype = {}
T.PlrBossSlime.prototype = {
    gan() {
        var s = $.a4(),
            r = $.mN()
        return H.b([s, r, $.X(), $.mL(), $.lL(), r, $.cY(), $.n_()], t.i)
    },
    gaS() {
        return H.b([], t.V)
    },
    gaG() {
        return H.b([$.bT()], t.V)
    },
    ac() {
        this.k3 = T.hE(this)
        this.k1.push(new T.ef(0))
    }
}
T.fb.prototype = {
    gan() {
        return null
    },
    eV() {
        var s, r, q, p = this
        if (p.aC == $.i()) {
            for (s = 0; r = $.Z(), s < r; ++s) p.t[s] = $.aR()
            for (s = r; s < $.b1(); ++s) {
                q = p.t
                q[s] = (q[s] | $.aR()) >>> 0
            }
        } else {
            for (s = 0; r = $.Z(), s < r; ++s) p.t[s] = -$.X()
            for (s = r; s < $.b1(); ++s) {
                q = p.t
                q[s] = (q[s] | $.at()) >>> 0
            }
        }
    },
    a7(a, b) {
        return false
    },
    ac() {
        var s, r, q = this
        q.aC = q.dk.aC + $.i()
        q.k3 = T.SklAttack(q)
        s = q.k1
        if (q.aC == $.i()) s.push(new T.ef(0))
        else {
            r = new T.sklHalf(0)
            r.f = $.at()
            s.push(r)
            r = new T.SklHeal(0)
            r.f = $.at()
            s.push(r)
        }
    },
    $ibC: 1,
    gap() {
        return this.dk
    }
}
T.hF.prototype = {
    gT() {
        return 0
    }
}
T.ef.prototype = {
    ga4() {
        return $.ao()
    },
    b1(a, b, c, d) {
        var s, r, q, p, o, n, m, l = this,
            k = null
        l.r.r2.m(0, $.iJ(), new T.hF())
        s = d.a
        s.push($.K())
        s.push(T.RunUpdate(LangData.get_lang("BJOA"), l.r, k, k, k, 0, 1000, 100))
        r = t.b8
        q = r.a(l.r)
        p = T.nD(q, q.a, q.b)
        p.y = l.r.y
        p.az()
        p.l = c.n() * $.C()
        l.r.y.aZ(p)
        r = r.a(l.r)
        o = T.nD(r, r.a, r.b)
        o.y = l.r.y
        o.az()
        o.l = c.n() * $.C()
        l.r.y.aZ(o)
        r = LangData.get_lang("eHVA")
        q = p.fx
        n = new T.HPlr(q)
        n.a = p.e
        n.d = q
        q = o.fx
        m = new T.HPlr(q)
        m.a = o.e
        m.d = q
        s.push(T.RunUpdate(r, n, m, k, k, 0, 1000, 100))
        return false
    },
    W() {
        this.r.L.j(0, this)
    },
    $iaF: 1
}
T.fc.prototype = {
    gan() {
        var s = $.Z(),
            r = $.a4(),
            q = $.eS(),
            p = 0
        return H.b([s, -r, q, p, s, -$.eT(), r, p], t.i)
    },
    gaS() {
        return H.b([], t.V)
    },
    gaG() {
        return H.b([$.bT()], t.V)
    },
    ac() {
        var s, r
        this.k3 = T.hE(this)
        s = this.k1
        r = new T.SklRapid(0)
        r.f = $.aI()
        s.push(r)
        r = new T.SklCritical(0)
        r.f = $.aI()
        s.push(r)
        r = new T.SklCounter(0)
        r.f = $.aI()
        s.push(r)
    }
}
T.fd.prototype = {
    gan() {
        return H.b([$.pt(), $.d1(), $.mX(), $.n2(), $.bg(), $.X(), $.at(), $.eW()], t.i)
    },
    gaS() {
        return H.b([], t.V)
    },
    gaG() {
        return H.b([], t.V)
    },
    ac() {
        var s, r
        this.k3 = T.hE(this)
        s = this.k1
        r = new T.eg(0)
        r.f = $.eX()
        s.push(r)
        r = new T.SklDefend(0)
        r.f = $.aI()
        s.push(r)
        r = new T.SklReflect(0)
        r.f = $.aI()
        s.push(r)
    }
}
T.eg.prototype = {
    as(a, b) {
        var s = a.y,
            r = this.r
        return s != r.z && a !== r && !a.r2.J(0, $.aE())
    },
    v(a, b, c, d) {
        var s, r, q, p, o = null,
            n = a[0].a,
            m = d.a
        m.push(T.RunUpdate(LangData.get_lang("wneN"), this.r, n, o, o, $.i(), 1000, 100))
        s = n.y.c.length
        r = $.B()
        if (s < r) s = r
        q = t.o.a(n.r2.h(0, $.aE()))
        p = this.r
        if (q == null) {
            q = T.nG(p.z, n)
            q.z = s
            q.aP(0)
        } else {
            q.r = p.z
            q.z = q.z + s
        }
        m.push(T.RunUpdate(C.String.B(LangData.get_lang("yjhn"), $.nd()), this.r, n, o, o, $.cZ(), 1000, 100))
    }
}
T.fo.prototype = {
    bD() {
        logger.debug("看起来到 main 了")
        // 我盯上你了
        var async_goto = 0,
            async_completer = P._makeAsyncAwaitCompleter(t.z),
            q, this_ = this,
            o, n, m, l, k, j, i, h, g, f, e, d, c, b, a, a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, b0, b1, b2, b3
        var $async$bD = P._wrapJsFunctionForAsync(function (b4, b5) {
            if (b4 === 1) return P.async_rethrow(b5, async_completer)
            while (true) switch (async_goto) {
                case 0:
                    b3 = H.b([], t.V)
                    for (o = this_.x, n = o.length, m = t.eG, l = this_.r, k = this_.z, j = t.L, i = this_.a, h = 0; h < o.length; o.length === n || (0, H.F)(o), ++h) {
                        g = o[h]
                        f = H.b([], j)
                        e = new T.b7(this_, f, H.b([], j), H.b([], j), H.b([], j))
                        for (d = (g && C.Array).ga0(g); d.u();) {
                            c = d.gC()
                            if (!(c instanceof T.Plr))
                                if (m.b(c) && J.aw(c) >= $.t()) {
                                    b = J.a3(c)
                                    b.h(c, 0)
                                    b.h(c, $.i())
                                    a = b.gp(c)
                                    a0 = $.t()
                                    a1 = a > a0 ? b.h(c, a0) : null
                                    if (typeof b.h(c, $.i()) == "string") {
                                        a = J.aw(b.h(c, $.i()))
                                        a0 = $.i()
                                        a = a === a0 && J.ny(b.h(c, a0), 0) < $.pC()
                                    } else a = false
                                    a2 = a ? T.init_boss(b.h(c, 0), b.h(c, $.i()), this_, a1) : T.nT(b.h(c, 0), b.h(c, $.i()), e.b, a1)
                                    if (a2 instanceof T.cy) {
                                        b3.push(a2.e)
                                        k.push(a2)
                                        continue
                                    }
                                    if (l.J(0, a2.e)) continue
                                    if (e.b == null) e.b = a2.c
                                    a2.y = e
                                    f.push(a2)
                                    l.m(0, a2.e, a2)
                                }
                        }
                        if (f.length !== 0) {
                            i.push(e)
                            a3 = f.length
                            for (a4 = 0; a4 < a3; ++a4) {
                                a2 = f[a4]
                                for (a5 = a4 + $.i(); a5 < a3; ++a5) {
                                    a6 = f[a5]
                                    if (a2.b == a6.b) {
                                        a2.cA(a6.E)
                                        a6.cA(a2.E)
                                    }
                                }
                            }
                        }
                    }
                    this_.Q = i.length
                    if (C.JsInt.am(l.gp(l), $.Z()) > 0) {
                        // errorMaxPlayer
                        // 错误，目前最多支持1000人PK
                        this_.f = LangData.get_lang("CefA")
                        async_goto = 1
                        break
                    }
                    if (l.gp(l) < $.t()) {
                        // errorMinPlayer
                        // 错误，请至少输入两行名字
                        this_.f = LangData.get_lang("MAda")
                        async_goto = 1
                        break
                    }
                    o = l.gad(l)
                    a7 = P.List_List_of(o, true, H._instanceType(o).i("L.E"))
                    C.Array.aJ(a7)
                    if (b3.length !== 0) {
                        a8 = H.b(a7.slice(0), H._arrayInstanceType(a7))
                        C.Array.a5(a8, b3)
                        C.Array.aJ(a8)
                    } else {
                        a8 = a7
                    }
                    o = C.Array.aV(a8, "\r")
                    a9 = C.e.gaB().ab(o)
                    o = new LangData.SuperRC4()
                    o.bd(a9, $.i())
                    this_.b = o
                    o.bO(a9)
                    o = a7.length, h = 0
                case 3:
                    if (!(h < a7.length)) {
                        async_goto = 5
                        break
                    }
                    b0 = a7[h]
                    async_goto = 6
                    return P._asyncAwait(l.h(0, b0).cg(), $async$bD)
                case 6:
                    n = l.h(0, b0)
                    m = this_.b
                    n.Q = (m.n() << 16 | m.n() << 8 | m.n()) >>> 0
                case 4:
                    a7.length === o || (0, H.F)(a7), ++h
                    async_goto = 3
                    break
                case 5:
                    for (o = i.length, h = 0; h < i.length; i.length === o || (0, H.F)(i), ++h) {
                        e = i[h]
                        n = e.c
                        m = H._arrayInstanceType(n)
                        k = H.b(n.slice(0), m)
                        e.d = k
                        n = H.b(n.slice(0), m)
                        if (n.immutable$list) H.throw_expression(P.UnsupportError("sort"))
                        m = n.length - 1
                        if (m - 0 <= 32) H.ej(n, 0, m, T.mD())
                        else H.ei(n, 0, m, T.mD())
                        e.e = n
                        n = H.b(n.slice(0), H._arrayInstanceType(n))
                        e.f = n
                    }
                    o = l.gfP(l)
                    o = P.List_List_of(o, true, H._instanceType(o).i("L.E"))
                    C.Array.bb(o, T.mD())
                    this_.c = o
                    if (C.JsInt.am(l.gp(l) + $.X(), $.C()) === 0)
                        for (o = this_.c, n = o.length, h = 0; h < n; ++h) {
                            a2 = o[h]
                            a2.I = a2.gbT()
                        }
                    o = H.b(i.slice(0), H._arrayInstanceType(i))
                    C.Array.bb(o, T.v4())
                    this_.d = o
                    for (n = o.length, m = t.i, l = this_.e, h = 0; h < o.length; o.length === n || (0, H.F)(o), ++h) {
                        b1 = o[h]
                        for (k = b1.f, j = k.length, b2 = 0; b2 < k.length; k.length === j || (0, H.F)(k), ++b2) {
                            a2 = k[b2]
                            i = this_.b
                            f = a2.e
                            i.bO(C.e.gaB().ab(f))
                        }
                        this_.b.bO(H.b([0], m))
                        C.Array.a5(l, b1.f)
                    }
                    for (o = this_.c, n = o.length, h = 0; h < o.length; o.length === n || (0, H.F)(o), ++h) o[h].l = this_.b.n()
                case 1:
                    return P.async_return(q, async_completer)
            }
        })
        return P._asyncStartSync($async$bD, async_completer)
    },
    bE() {
        // var async_goto = 0,
        //     r = P._makeAsyncAwaitCompleter(t.z)
        // var $async$bE = P._wrapJsFunctionForAsync(function (a, b) {
        //     if (a === 1) return P.async_rethrow(b, r)
        //     while (true) switch (async_goto) {
        //         case 0:
        //             async_goto = 2
        //             // return P._asyncAwait(P.future_future_delayed(P.duration_milsec_sec($.C(), 0), t.z), $async$bE)
        //             return P._asyncAwait(P.future_future_delayed(P.duration_milsec_sec(0, 0), t.z), $async$bE)
        //             // break
        //         case 2:
        //             $.mc = 0
        //             return P.async_return(null, r)
        //     }
        // })
        // return P._asyncStartSync($async$bE, r)
        // $.mc = 0
        why_ns = 0
    },
    fz(a, b) {
        var s, this_ = this,
            q = this_.ch,
            p = $.i(),
            o = this_.c
        p = C.JsInt.V(q + p, o.length)
        this_.ch = p
        J.rz(o[p], this_.b, b)
        for (q = t.Y; p = b.b, p.length !== 0;) {
            b.b = H.b([], q)
            for (o = p.length, s = 0; s < p.length; p.length === o || (0, H.F)(p), ++s) p[s].$2(this_.b, b)
        }
    },
    O() {
        // 运行时?
        logger.debug("运行 主循环")
        var async_goto = 0,
            async_completer = P._makeAsyncAwaitCompleter(t.d),
            result_, p = [],
            this_ = this,
            n, m, l, k, j, i, h, g, f
        var $async$O = P._wrapJsFunctionForAsync(function (a, b) {
            if (a === 1) return P.async_rethrow(b, async_completer)
            while (true) $async$outer: switch (async_goto) {
                case 0:
                    if (this_.cx) {
                        result_ = null
                        async_goto = 1
                        break
                    }
                    n = new T.aq(H.b([], t.U), H.b([], t.Y))
                    k = this_.cy
                    async_goto = k != null ? 3 : 4
                    break
                case 3:
                    k = k.c[0]
                    // win
                    // [2]获得胜利
                    j = LangData.get_lang("eTpN")
                    logger.debug("getting win from T.fo.O")
                    i = 0
                    h = $.lJ()
                    g = new T.dX(i, h, 100, j, k, null, null, null)
                    g.aK(j, k, null, null, null, i, h, 100)
                    n.a.push(g)
                    this_.cx = true
                    async_goto = 5
                    // return P._asyncAwait(this_.bE(), $async$O)
                    why_ns = 0
                // $.mc = 0 // 来自bE()
                case 5:
                    result_ = n
                    async_goto = 1
                // break
                case 4:
                    try {
                        for (; this_.cy == null;) {
                            this_.fz(0, n)
                            if (n.a.length !== 0) {
                                result_ = n
                                async_goto = 1
                                break $async$outer
                            }
                        }
                    } catch (e) {
                        m = H.unwrap_Exception(e)
                        l = H.getTraceFromException(e)
                    }
                    if (n.a.length !== 0) {
                        result_ = n
                        async_goto = 1
                        break
                    }
                    result_ = null
                    async_goto = 1
                    break
                case 1:
                    return P.async_return(result_, async_completer)
            }
        })
        return P._asyncStartSync($async$O, async_completer)
    },
    ae(a, b) {
        if (run_env.from_code) {
            return null
        }
        return this.dM(0, b)
    },
    dM(a, b) {
        // var async_goto = 0,
        //     async_completer = P._makeAsyncAwaitCompleter(t.z),
        //     this_ = this,
        //     p, o, n, m, l, k, j
        // var $async$ae = P._wrapJsFunctionForAsync(function (c, d) {
        //     if (c === 1) return P.async_rethrow(d, async_completer)
        //     while (true) switch (async_goto) {
        //         case 0:
        //             this_.db = b
        //             p = Date.now()
        //             o = $.bx()
        //             n = this_.dx
        //             n[0] = p + o
        //             o = this_.a
        //             m = new H.y(o, new T.jk(), H._arrayInstanceType(o).i("y<1,m*>")).aV(0, "\n")
        //             p = this_.z
        //             o = p.length
        //             if (o !== 0)
        //                 for (l = 0; l < p.length; p.length === o || (0, H.F)(p), ++l) {
        //                     k = p[l]
        //                     m += "\n" + H.as_string(k.e) + "\t" + H.as_string(k.a)
        //                 }
        //             p = C.e.gaB().ab(m)
        //             logger.debug("initing in T.fi.dM")
        //             o = H.instanceType(p).i("a9<z.E>")
        //             logger.debug("initing in T.fi.dM")
        //             j = o.i("y<M.E,l*>")
        //             j = P.List_List_of(new H.y(new H.a9(p, o), new T.jl(this_), j), true, j.i("M.E"))
        //             C.Array.a5(j, H.fJ(n.buffer, 0, null))
        //             A.eR(X.dc(j))
        //             return P.async_return(null, async_completer)
        //     }
        // })
        // return P._asyncStartSync($async$ae, async_completer)
        let this_ = this,
            p, o, n, m, l, k, j
        this_.db = b
        p = Date.now()
        o = $.bx()
        n = this_.dx
        n[0] = p + o
        o = this_.a
        m = new H.y(o, new T.jk(), H._arrayInstanceType(o).i("y<1,m*>")).aV(0, "\n")
        p = this_.z
        o = p.length
        if (o !== 0)
            for (l = 0; l < p.length; p.length === o || (0, H.F)(p), ++l) {
                k = p[l]
                m += "\n" + H.as_string(k.e) + "\t" + H.as_string(k.a)
            }
        p = C.e.gaB().ab(m)
        logger.debug("initing in T.fi.dM")
        o = H.instanceType(p).i("a9<z.E>")
        logger.debug("initing in T.fi.dM")
        j = o.i("y<M.E,l*>")
        j = P.List_List_of(new H.y(new H.a9(p, o), new T.jl(this_), j), true, j.i("M.E"))
        C.Array.a5(j, H.fJ(n.buffer, 0, null))
        A.eR(X.dc(j))
    },
    cq(a, b) {
        return this.f7(a, b)
    },
    f7(a, b) {
        var async_goto = 0,
            r = P._makeAsyncAwaitCompleter(t.z),
            q = this,
            p, o, n
        var $async$cq = P._wrapJsFunctionForAsync(function (c, d) {
            if (c === 1) return P.async_rethrow(d, r)
            while (true) switch (async_goto) {
                case 0:
                    n = H.as_string(a.gap().e) + "\r" + H.as_string(a.I.$0())
                    n = C.e.gaB().ab(n)
                    p = H.instanceType(n).i("a9<z.E>")
                    o = p.i("y<M.E,l*>")
                    o = P.List_List_of(new H.y(new H.a9(n, p), new T.ji(q), o), true, o.i("M.E"))
                    C.Array.a5(o, H.fJ(q.dx.buffer, 0, null))
                    A.eR(X.dc(o))
                    return P.async_return(null, r)
            }
        })
        return P._asyncStartSync($async$cq, r)
    },
    gbu(a) {
        return this.f
    }
}
T.jk.prototype = {
    $1(a) {
        var s = a.d
        return new H.y(s, new T.jj(), H._arrayInstanceType(s).i("y<1,@>")).aV(0, "\r")
    },
    $S: 49
}
T.jj.prototype = {
    $1(a) {
        return a.I.$0()
    },
    $S: 3
}
T.jl.prototype = {
    $1(a) {
        return (a ^ this.a.db) >>> 0
    },
    $S: 2
}
T.ji.prototype = {
    $1(a) {
        return (a ^ this.a.db) >>> 0
    },
    $S: 2
}
T.b7.prototype = {
    aZ(a) {
        var s, r, q = this,
            p = q.a
        if (!C.Array.w(p.c, a)) {
            // $.mc = $.ns() - 1
            why_ns -= 1
            C.Array.j(p.c, a)
        }
        s = p.e
        if (!C.Array.w(s, a)) {
            r = q.f
            if (r.length > 0) C.Array.co(s, C.Array.aT(s, C.Array.gbl(r)) + $.i(), a)
            else s.push(a)
            if (p.db > -$.i()) p.cq(a, q)
        }
        // if (!C.Array.w(q.e, a)) C.Array.j(q.e, a)
        // if (!C.Array.w(q.d, a)) C.Array.j(q.d, a)
        // if (!C.Array.w(q.f, a)) C.Array.j(q.f, a)
        if (!q.e.includes(a)) q.e.push(a)
        if (!q.d.includes(a)) q.d.push(a)
        if (!q.f.includes(a)) q.f.push(a)
    },
    dj(a) {
        var s, r, q, p
        C.Array.U(this.f, a)
        s = this.a
        r = s.e
        C.Array.U(r, a)
        if (s.ch <= C.Array.aT(s.c, a)) --s.ch
        C.Array.U(s.c, a)
        q = this.f.length
        p = 0
        if (q === p) {
            s.Q = s.Q - 1
            q = r[p].y
            if (q.f.length === r.length) {
                s.cy = q
                H.throw_expression(q)
            }
        }
    },
    k(a) {
        return "[" + H.as_string(this.c[0].r) + "]"
    }
}
T.IPlr.prototype = {
    k(a) {
        return this.a
    },
    gb2() {
        return this.a
    }
}
T.NPlr.prototype = {}
T.HPlr.prototype = {}
T.MPlr.prototype = {
    cO(a) {
        this.a = a.e
        this.b = a.fx
        this.c = a.fy
    }
}
T.DPlr.prototype = {}
T.HDamage.prototype = {
    k(a) {
        return J.b4(this.a)
    }
}
T.HRecover.prototype = {
    k(a) {
        return J.b4(this.a)
    }
}
T.aX.prototype = {
    aK(a, b, c, d, e, f, g, h) {
        var s, r, q, this_ = this,
            tmp = this_.e
        // caster
        if (tmp instanceof T.Plr) {
            s = new T.NPlr()
            s.a = tmp.e
            this_.e = s
        }
        // target
        tmp = this_.f
        if (tmp instanceof T.Plr) {
            s = new T.NPlr()
            s.a = tmp.e
            this_.f = s
        }
        // param
        tmp = this_.x
        if (tmp instanceof T.Plr) {
            s = new T.NPlr()
            s.a = tmp.e
            this_.x = s
        }
        // targets2
        tmp = this_.r
        if (tmp != null)
            for (r = 0; r < tmp.length; ++r) {
                s = tmp[r]
                if (s instanceof T.Plr) {
                    q = new T.NPlr()
                    q.a = s.e
                    tmp[r] = q
                }
            }
    },
    // to string
    k(a) {
        var _this = this,
            r = _this.d,
            q = _this.e
        if (q != null) {
            q = q.k(0)
            if (typeof q != "string") H.throw_expression(H.R(q))
            r = H.mF(r, "[Dn.n0]", q)
        }
        q = _this.f
        if (q != null) {
            q = q.k(0)
            if (typeof q != "string") H.throw_expression(H.R(q))
            r = H.mF(r, "[Dn.n1]", q)
        }
        q = _this.x
        if (q != null) {
            q = J.b4(q)
            if (typeof q != "string") H.throw_expression(H.R(q))
            r = H.mF(r, "[Dn.n2]", q)
        }
        return r
    }
}
T.h2.prototype = {}
T.dX.prototype = {}
T.aq.prototype = {
    k(a) {
        // return H.e(this.a)
        // console.log(a, this.a, H.e(this.a))
        return H.as_string(this.a)
    }
}
T.lD.prototype = {
    $1(a) {
        var s, r = this.a
        r.c = r.c + 1
        s = this.b
        s[a] = s[a] + 1
        if (a != r.b) {
            r.a = r.a + 1
            r.b = a
        }
    },
    $S: 50
}
T.aM.prototype = {
    b1(a, b, c, d) {
        var s = this,
            r = s.fx,
            q = 0
        if (r > q) {
            s.fx = q
            s.bm(r, null, c, d)
        }
        s.a6.D()
        return false
    },
    cD() {
        return LangData.get_lang("Kcon")
    },
    bf() {
        this.x = $.ao()
    },
    $ibC: 1
}
T.Plr.prototype = {
    a7(a, b) {
        return false
    },
    bw(a) {
        var s, r, q, p = this
        if (p.fx <= 0 || p.A) return false
        s = a.n()
        r = (((s & 15) + 1) * ((C.JsInt.am(s, 4) & 15) + 1) >>> 5) + 1
        q = p.go
        if (q >= r) {
            p.go = q - r
            return true
        }
        return false
    },
    a1(a, b, c, d) {
        // Plr 构造函数
        // 名字字符输入的处理在此
        var s, r, q, p, o, n, m, l, k, j, i, this_ = this
        this_.I = this_.gfJ()
        s = this_.r = this_.a // 名字第一部分
        r = this_.b // @ 号以后的东西
        if (r != null && r !== "" && r !== s) {
            // 有战队情况下构造名字
            r = this_.e = H.as_string(s) + "@" + H.as_string(this_.b)
        } else {
            this_.e = this_.b = s
            r = s
        }
        this_.f = r
        q = this_.d // + 号以后的东西
        if (q != null && q !== "") {
            // MARK: DIY part
            if (q.startsWith("diy")) {
                this_.diy = q.slice(3)
            } else {
                this_.f = H.as_string(r) + "+" + H.as_string(q)

                // 武器列表
                r = $.rj()
                console.log("$.rj()", $.rj())
                if (r.J(0, q)) {
                    p = r.h(0, q).$2(q, this_)
                } else if (J.nz(q, $.cl())) {
                    p = new T.j2(q, this_, P.aL($.av(), 0, false, t.B))
                    p.a = q
                    p.a = C.String.af(q, 0, q.length - $.i())
                } else {
                    p = T.tN(q, this_)
                }

                o = new LangData.SuperRC4()
                o.bd(LangData.fZ(p.a), $.t())
                p.b3(o)
                this_.weapon = p
            }
        }
        if (J.lW(s, " ")) {
            this_.r = s.split(" ")[0]
        }
        if (this_.c == null) {
            this_.c = this_.b
        }
        r = new LangData.SuperRC4()

        r.bd(LangData.fZ(this_.b), $.i())
        this_.X = r
        // q = $.ns()
        // $.mc = q + 1
        q = why_ns
        why_ns += 1

        q = C.JsInt.P(Math.abs(q), $.bx())
        n = 0
        if (q > n) {
            q = r.c
            m = q[n]
            l = $.i()
            q[n] = q[l]
            q[l] = m
        }
        r.dB(0, LangData.fZ(s), $.t())
        for (s = this_.X.c, s.length, r = this_.a2, k = 0; k < 256; ++k) {
            j = s[k]
            i = (j * $.nW + $.nV & $.mP()) >>> 0
            if (i >= $.mb && i < $.r2()) {
                C.Array.j(this_.t, (i + $.r3() * $.r4().ax($.eX()) & $.b2()) >>> 0)
            } else r.push(j)
        }
        s = this_.t
        s = H.b(s.slice(0), H._arrayInstanceType(s))
        this_.E = s
        this_.ac() // createSkills, 对this.k1直接操作，顺序固定
        this_.k2 = this_.X.dH(this_.k1, t.c5) // 以某种方式打乱顺序？
    },
    bf() {
        var s, r = this,
            q = r.a,
            p = q.length
        if (p > $.b3()) throw H.wrap_expression(p)
        p = r.b.length
        if (p > $.au()) throw H.wrap_expression(p)
        q = T.lC(q)
        p = T.lC(r.b)
        s = $.a4()
        r.x = Math.max(H.ar(q), p - s)
    },
    b0(a, b) {
        return C.d.aI(a * ($.T() - this.x / b))
    },
    cA(a) {
        //upgrade
        /// upgrade leader from team member
        var s, this_ = this
        if (a.length === this_.t.length) {
            for (s = $.ap(); s < this_.t.length; ++s)
                // if (J.Y(a[s - $.i()], r.E[s]) && a[s] > r.t[s]) {
                if ((a[s - $.i()] === this_.E[s]) && a[s] > this_.t[s]) {
                    this_.t[s] = a[s]
                }
            if (this_.a == this_.b)
                for (s = $.X(); s < this_.t.length; ++s)
                    // if (J.Y(a[s - $.t()], r.E[s]) && a[s] > r.t[s]) {
                    if ((a[s - $.t()] === this_.E[s]) && a[s] > this_.t[s]) {
                        this_.t[s] = a[s]
                    }
        }
    },
    cg() {
        // 
        var s = 0,
            r = P._makeAsyncAwaitCompleter(t.z),
            this_ = this
        var $async$cg = P._wrapJsFunctionForAsync(function (a, b) {
            if (a === 1) return P.async_rethrow(b, r)
            while (true) switch (s) {
                case 0:
                    this_.az()
                    return P.async_return(null, r)
            }
        })
        return P._asyncStartSync($async$cg, r)
    },
    az() {
        // buildAsync
        var weapon, diy, this_ = this
        this_.bf()
        weapon = this_.weapon
        if (weapon != null) weapon.bn()

        this_.aU() // initRawAttr
        this_.bP() // initLists


        // DIY自定义属性
        diy = this_.diy
        if (diy != null) {
            try {
                var tmparr = diy.split("]");
                var attrs = JSON.parse(tmparr[0] + "]");
                if (tmparr[1].startsWith("{")) var diyskills = JSON.parse(tmparr[1]);
                if (attrs.length != 8) throw new Error('八围要有八个元素')
            } catch (error) {
                console.error(error)
                alert("DIY捏人格式错误，请检查");
            }
            if (attrs) {
                for (var i = 0; i < 7; i++) {
                    attrs[i] -= 36; // 为当前项减去36
                }
                this.q = attrs
            }
            if (diyskills) {
                this.diy_skills(diyskills)
            } else this_.dm(C.Array.cL(this_.t, $.au()), C.Array.cL(this_.E, $.au())) // initSkills
        } else {
            this_.dm(C.Array.cL(this_.t, $.au()), C.Array.cL(this_.E, $.au())) // initSkills
        }

        weapon = this_.weapon
        if (weapon != null) weapon.cs()
        this_.bs() // addSkillsToProc
        this_.cn() // initValues
    },
    aU() {
        // initRawAttr
        var s, r, q, p, this_ = this
        for (s = $.Z(); s < 31; s += $.B()) {
            r = this_.q
            q = C.Array.al(this_.t, s, s + $.B())
            if (!!q.immutable$list) H.throw_expression(P.UnsupportError("sort"))
            p = q.length - 1
            if (p - 0 <= 32) H.ej(q, 0, p, J.bO())
            else H.ei(q, 0, p, J.bO())
            C.Array.j(r, q[$.i()])
        }
        r = this_.q

        q = C.Array.al(this_.t, 0, $.Z())
        C.Array.aJ(q)

        C.Array.j(r, C.Array.dz(C.Array.al(q, $.B(), $.ap()), new T.jX()) + $.mK())
        // 至此，属性初始化完毕，this_.q就是八围 但前7围要+36才是面板属性！！！
        // test
        //this_.q = [-36, 0, 0, 0, -36, 0, 0, 100]
    },
    bP() {
        //initLists
        var this_ = this
        C.Array.sp(this_.k4, 0)
        this_.r2.ah(0)
        this_.rx.ah(0)
        this_.ry.ah(0)
        this_.x1.ah(0)
        this_.x2.ah(0)
        this_.y1.ah(0)
        this_.y2.ah(0)
        this_.G.ah(0)
        this_.L.ah(0)
        this_.S.ah(0)
    },
    ac() {
        // create skills
        // createSkills()
        var skills, r, q
        this.k3 = T.SklAttack(this)
        skills = this.k1
        skills.push(new T.SklFire(0)); // 0
        skills.push(new T.SklIce(0)); // 1
        skills.push(new T.SklThunder(0)); // 2
        skills.push(new T.SklQuake(0)); // 3
        skills.push(new T.SklAbsorb(0)); // 4
        skills.push(new T.SklPoison(0)); // 5
        skills.push(new T.SklRapid(0)); // 6
        skills.push(new T.SklCritical(0)); // 7
        skills.push(new T.sklHalf(0)); // 8
        skills.push(new T.SklExchange(0)); // 9
        skills.push(new T.SklBerserk(0)); // 10
        skills.push(new T.SklCharm(0)); // 11
        skills.push(new T.SklHaste(0)); // 12
        skills.push(new T.SklSlow(0)); // 13
        skills.push(new T.SklCurse(0)); // 14
        skills.push(new T.SklHeal(0)); // 15
        skills.push(new T.SklRevive(0)); // 16
        skills.push(new T.SklDisperse(0)); // 17
        r = 0
        r = new T.SklIron(r, r, r)
        q = new T.dT(1 / 0, r)
        r.fr = q
        r.fx = new T.b8(r)
        r.fy = new T.bd(r)
        q.r = $.lG()
        skills.push(r) // 18
        r = 0
        r = new T.SklCharge(r, r)
        r.fr = new T.bd(r)
        r.fx = new T.b8(r)
        skills.push(r) // 19
        r = new T.SklAccumulate($.pj(), 0)
        r.fr = new T.bd(r)
        skills.push(r) // 20
        r = new T.SklAssassinate(0)
        r.fr = new T.ca(r)
        r.fx = new T.cA(r)
        skills.push(r) // 21
        skills.push(new T.SklSummon(0)); // 22
        skills.push(new T.SklClone(0)); // 23
        skills.push(new T.SklShadow(0)); // 24
        skills.push(new T.SklDefend(0)); // 25
        skills.push(new T.SklProtect(0)); // 26
        skills.push(new T.SklReflect(0)); // 27
        skills.push(new T.SklReraise(0)); // 28
        skills.push(new T.SklShield(0)); // 29
        skills.push(new T.SklCounter(0)); // 30
        skills.push(new T.SklMerge(0)); // 31
        skills.push(new T.SklZombie(0)); // 32
        r = new T.SklUpgrade(0)
        r.Q = new T.bd(r)
        skills.push(r) // 33
        r = new T.SklHide(0)
        r.ch = new T.bd(r)
        r.Q = new T.ca(r)
        skills.push(r) // 34
        skills.push(new T.SkillVoid(0))
        skills.push(new T.SkillVoid(0))
        skills.push(new T.SkillVoid(0))
        skills.push(new T.SkillVoid(0))
        skills.push(new T.SkillVoid(0))
    },
    diy_skills(diyskills) {
        try {
            // MARK: 自定义技能
            var sortedSkills = this.k2
            var this_ = this
            // 初始化技能
            for (var n = 0; n < this.k2.length; n++) this.k2[n].ao(this, 0)
            // 遍历diyskills字典的键
            var keys = Object.keys(diyskills);
            for (var k = 0; k < keys.length; k++) {
                // 遍历skills数组中的对象
                var key = keys[k]
                for (var i = 0; i < sortedSkills.length; i++) {
                    if (sortedSkills[i].constructor.name.toLowerCase() == key.toLowerCase()) {
                        sortedSkills[i].f = diyskills[key];
                        // skills[i].ao(this, this.f)

                        if (i != k) { // 把技能的顺序排一下
                            [sortedSkills[i], sortedSkills[k]] = [sortedSkills[k], sortedSkills[i]]
                        }
                        break;
                    }
                }
            }
        } catch (error) {
            console.log("error diy")
            console.error(error)
        }
    },
    dm(list, original) {
        // initSkills
        var skill, sortedSkills, q, p, this_ = this,
            n = 0,
            m = 0
        // src中被移除的计算技能部分
        while (true) {
            if (!(n < $.aR() && n < this_.k2.length)) break
            skill = this_.k2[n]
            sortedSkills = C.Array.al(list, m, m + $.C())
            if (!!sortedSkills.immutable$list) H.throw_expression(P.UnsupportError("sort"))
            q = sortedSkills.length - 1
            if (q - 0 <= 32) H.ej(sortedSkills, 0, q, J.bO())
            else H.ei(sortedSkills, 0, q, J.bO())
            p = sortedSkills[0] - 10
            skill.ao(this_, p)
            sortedSkills = 0
            if (p > sortedSkills) {
                sortedSkills = C.Array.al(original, m, m + $.C())
                if (!!sortedSkills.immutable$list) H.throw_expression(P.UnsupportError("sort"))
                q = sortedSkills.length - 1
                if (q - 0 <= 32) H.ej(sortedSkills, 0, q, J.bO())
                else H.ei(sortedSkills, 0, q, J.bO())
                q = 0
                if (sortedSkills[q] - 10 <= q) skill.e = true
            } ++n
            m += $.C() // 4
        }
        // console.log("this_.k2:",this_.k2)
        for (; sortedSkills = this_.k2, n < sortedSkills.length; ++n) sortedSkills[n].ao(this_, 0)
        // sorted skills是this.k2, 
    },
    bs() {
        // addSkillsToProc
        var s, actions, sortedSkills, skl, o, act, boostPassive, this_ = this
        for (s = 0, actions = this_.k4; sortedSkills = this_.k2, s < sortedSkills.length; ++s) {
            skl = sortedSkills[s]
            if (skl.f > 0 && skl instanceof T.ActionSkill) actions.push(skl)
        }
        if (this.diy == undefined) {
            if (actions.length > 0)
                for (s = actions.length - 1; s >= 0; --s) {
                    act = actions[s]
                    if (!act.e) { // !act.boosted
                        act.f = act.f * 2
                        act.e = true
                        break
                    }
                }
        }
        boostPassive = new T.BoostPassive()
        var skills = this_.k2
        if (skills.length >= $.aR()) {
            skills = skills[$.p7()]
            sortedSkills = this_.t
            boostPassive.boostPassive(skills, sortedSkills[$.a6()], sortedSkills[$.pR()])
            sortedSkills = this_.k2[$.eT()]
            skills = this_.t
            boostPassive.boostPassive(sortedSkills, skills[$.n_()], skills[$.b2()])
        }
        for (s = 0, skills = this_.k1; s < skills.length; ++s) {
            skl = skills[s]
            if (skl.f > 0) skl.W()
        }
    },
    cn() { // initValues
        var s = this
        s.F()
        s.fx = s.fy
        s.go = C.JsInt.P(s.fr, $.t())
    },
    F() {
        /*  void updateStates() {
          atk = attr[0];
          def = attr[1];
          spd = attr[2] + 160;
          agl = attr[3];
          mag = attr[4];
          mdf = attr[5];
          itl = attr[6];
          maxhp = attr[7];

          calcAttrSum();

          allyGroup = group;
          atboost = 1.0;

          frozen = false;

          for (UpdateStateEntry ude in updatestates) {
            ude.updateState(this);
          }
        }
        */
        var s, this_ = this
        this_.ch = this_.b0(this_.q[0], $.cj())
        this_.cx = this_.b0(this_.q[1], $.cj())
        this_.cy = this_.b0(this_.q[2], $.cj()) + 160
        this_.db = this_.b0(this_.q[3], $.cj())
        this_.dx = this_.b0(this_.q[4], $.cj())
        this_.dy = this_.b0(this_.q[5], $.cj())
        this_.fr = this_.b0(this_.q[6], $.n1())
        this_.fy = this_.q[7]

        this_.ci()
        this_.z = this_.y
        this_.id = $.T()
        this_.A = false
        for (s = this_.rx, s = new Sgls.a_(s, s.b, s.$ti.i("a_<1*>")); s.u();) {
            s.b.ar(this_)
        }
    },
    ci() {
        // calcAttrSum
        var attr_sum, r, q, p, o, n, m, l, k, j, i = this,
            this_ = this,
            h = i.M = 0
        for (attr_sum = h; h < 7; ++h) {
            attr_sum += this_.q[h]
            this_.M = attr_sum
        }
        q = this_.q
        p = q[0]
        o = q[$.i()]
        n = $.t()
        m = q[n]
        l = q[$.C()]
        k = q[$.X()]
        j = $.B()
        i.N = (p - o + m + l - k) * n + q[j] + q[$.a4()]
        i.Y = attr_sum * j + q[r]
        i.H = $.W()
    },
    dN(a, b, c) {
        var s, r, q, p = this
        if (p.fx <= 0) return
        s = p.cy * (b.n() & 3)
        r = p.ry
        if (!r.gbv(r))
            for (r = new Sgls.a_(r, r.b, r.$ti.i("a_<1*>")); r.u();) s = r.b.x.fo(s, b, c)
        r = p.l = p.l + s
        q = $.bx()
        if (r > q) {
            p.l = r - q
            p.eE(0, b, c)
        }
    },
    eE(a, b, c) {
        var s, r, q, p, o, n, m, l = this,
            k = null,
            j = (b.n() & 63) < l.fr
        0
        s = l.fn(j, b, c)
        if (l.A) return
        if (s == null) {
            r = (b.n() & 15) + $.av()
            if (l.go >= r) {
                for (q = l.k4, p = q.length, o = k, n = 0; n < q.length; q.length === p || (0, H.F)(q), ++n) {
                    m = q[n]
                    if (!m.au(b, j)) continue
                    o = m.aa(0, j, b)
                    if (o == null) continue
                    s = m
                    break
                }
                l.go = l.go - r
            } else o = k
        } else o = k
        if (s == null) s = l.k3
        s.v(o == null ? s.aa(0, j, b) : o, j, b, c)
        if ((b.n() & 127) < l.fr + $.au()) l.go = l.go + $.aR()
        l.at(b, c)
        if (l.Z) l.bL(k, c)
    },
    bL(a, b) {
        var s, r, q, p, o, n = this
        if (n.a_) {
            n.Z = true
            return
        }
        n.Z = false
        for (s = n.r2, r = s.gad(s), r = P.List_List_of(r, true, H._instanceType(r).i("L.E")), C.Array.aJ(r), q = r.length, p = 0; p < r.length; r.length === q || (0, H.F)(r), ++p) {
            o = r[p]
            if (s.h(0, o).gT() < 0) {
                s.h(0, o).K(a, b)
                s.U(0, o)
            }
        }
    },
    fn(a, b, c) {
        var s, r
        for (s = this.x1, s = new Sgls.a_(s, s.b, s.$ti.i("a_<1*>")), r = null; s.u();) r = s.b.aN(r, a, b, c)
        return r
    },
    at(a, b) {
        var s
        this.a_ = true
        b.a.push($.K())
        for (s = this.x2, s = new Sgls.a_(s, s.b, s.$ti.i("a_<1*>")); s.u();) s.b.at(a, b)
        this.a_ = false
    },
    du(a, b, c, d, e, f) {
        var s, r
        for (s = this.y1, s = new Sgls.a_(s, s.b, s.$ti.i("a_<1*>")); s.u();) {
            a = s.b.dv(a, b, c, this, d, e, f)
            r = $.ao()
            if (a == r) return r
        }
        return a
    },
    aq(a, b, c, d, e) {
        var s
        for (s = this.y2, s = new Sgls.a_(s, s.b, s.$ti.i("a_<1*>")); s.u();) a = s.b.aq(a, b, c, d, e)
        return a
    },
    a3(a, b, c, d, e, f) {
        var s, r, q, p = this
        a = p.du(a, b, c, d, e, f)
        if (a == $.ao()) return 0
        s = p.db
        if (b) {
            r = p.dy + s
            q = c.dx + c.db
        } else {
            r = p.cx + s
            q = c.ch + c.db
        }
        if (p.fx > 0 && !p.A && T.bW(q, r, e)) {
            // dodge (通用回避)
            // [0][回避]了攻击
            f.a.push(T.RunUpdate(LangData.get_lang("BtqN"), p, c, null, null, $.as(), 1000, 100))
            return 0
        }
        return p.bN(a, b, c, d, e, f)
    },
    bN(a, b, c, d, e, f) {
        return this.aF(this.aq(C.d.R(a / T.d9(this, b, e)), c, d, e, f), c, d, e, f)
    },
    aF(a, b, c, d, e) {
        var s, r, q, p, o, n = this
        if (a < 0) {
            s = n.fx
            r = s - a
            n.fx = r
            q = n.fy
            if (r > q) n.fx = q
            r = LangData.get_lang("imin")
            q = new T.HPlr(s)
            q.a = n.e
            q.d = n.fx
            e.a.push(T.RunUpdate(r, b, q, new T.HRecover(-a), null, 0, 1000, 100))
            return 0
        }
        p = LangData.get_lang("kZsn")
        r = 0
        if (a === r) {
            e.a.push(T.RunUpdate(C.String.B(C.String.fu(p, "1", "0"), $.ne()), n, n, new T.HDamage(0), null, 10, 1000, 100))
            return 0
        }
        s = n.fx
        q = s - a
        n.fx = q
        if (q <= r) n.fx = r
        if (a >= $.eU()) p = C.String.B(p, $.qz())
        else if (a >= $.cZ()) p = C.String.B(p, $.qy())
        r = new T.HPlr(s)
        r.a = n.e
        r.d = n.fx
        o = T.RunUpdate(p, b, r, new T.HDamage(a), null, a, 1000, 100)
        if (a > $.pr()) o.b = $.d0()
        else o.b = $.eS() + a * $.t()
        e.a.push(o)
        c.$5(b, n, a, d, e)
        return n.cr(a, s, b, d, e)
    },
    cr(a, b, c, d, e) {
        var s
        for (s = this.G, s = new Sgls.a_(s, s.b, s.$ti.i("a_<1*>")); s.u();) s.b.aD(a, c, d, e)
        if (this.fx <= 0) {
            this.bm(b, c, d, e)
            return b
        } else return a
    },
    cD() {
        return LangData.get_lang("avqN")
    },
    bm(a, b, c, d) {
        var s, r, q = this,
            p = d.a
        p.push($.K())
        s = q.cD()
        r = new T.DPlr()
        r.a = q.e
        p.push(T.RunUpdate(s, b, r, null, null, $.b1(), 1000, 100))
        for (p = q.L, p = new Sgls.a_(p, p.b, p.$ti.i("a_<1*>")); p.u();)
            if (p.b.b1(a, b, c, d)) break
        if (q.fx > 0) return
        q.y.dj(q)
        if (b != null && b.fx > 0) b.bS(q, c, d)
    },
    bS(a, b, c) {
        var s
        for (s = this.S, s = new Sgls.a_(s, s.b, s.$ti.i("a_<1*>")); s.u();)
            if (s.b.bS(a, b, c)) break
    },
    k(a) {
        return "[" + H.as_string(this.r) + "]"
    },
    fK() {
        var s = this
        return H.as_string(s.e) + "\t" + H.as_string(s.r) + "\t" + H.as_string(s.c) + "\t" + H.as_string(s.f) + "\t" + H.as_string(s.fy)
    },
    cE() {
        // 1200 here
        var s, r = this.Y,
            q = $.p4()
        if (r > q) {
            s = C.JsInt.P(r - q, $.a6())
            r = $.t()
            if (s > r) return C.JsInt.k(r)
            else return C.JsInt.k(s)
        }
        return ""
    },
    dE() {
        var s, r, q, p, o = this,
            n = H.b([], t.V)
        if (o instanceof T.cz) n = C.N
        else {
            s = H.b([], t.i)
            for (r = 10; r < $.d1(); r += $.B()) {
                q = C.Array.al(o.E, r, r + $.B())
                if (!!q.immutable$list) H.throw_expression(P.UnsupportError("sort"))
                p = q.length - 1
                if (p - 0 <= 32) H.ej(q, 0, p, J.bO())
                else H.ei(q, 0, p, J.bO())
                s.push(q[$.i()])
            }
            q = C.Array.al(o.E, 0, 10)
            C.Array.aJ(q)
            s.push(C.Array.dz(C.Array.al(q, $.B(), $.ap()), new T.jY()) + $.mK())
            for (r = 0; r < s.length; ++r)
                if (o.q[r] > s[r]) n.push(H.as_string($.lO()) + H.as_string(o.q[r] - s[r]))
                else n.push("")
        }
        return H.as_string(o.e) + "\t" + H.as_string(o.r) + "\t" + H.as_string(o.c) + "\t" + H.as_string(o.f) + "\t" + H.as_string(o.fy) + n[$.ap()] + "\t" + H.as_string(o.aY(o.q[0])) + n[0] + "\t" + H.as_string(o.aY(o.q[$.i()])) + n[$.i()] + "\t" + H.as_string(o.aY(o.q[$.t()])) + n[$.t()] + "\t" + H.as_string(o.aY(o.q[$.B()])) + n[$.B()] + "\t" + H.as_string(o.aY(o.q[$.C()])) + n[$.C()] + "\t" + H.as_string(o.aY(o.q[$.X()])) + n[$.X()] + "\t" + H.as_string(o.aY(o.q[$.a4()])) + n[$.a4()] + "\t" + H.as_string(o.cE())
    },
    aY(a) {
        var s = $.mU()
        if (a > $.q4()) {
            return $.iK() // ??
        }
        return C.JsInt.k(a + s)
    },
    gb2() {
        return this.e
    }
}
T.jX.prototype = {
    $2(a, b) {
        return a + b
    },
    $S: 15
}
T.BoostPassive.prototype = {
    boostPassive(a, b, c) {
        var s = a.f
        if (s > 0 && !a.e) {
            a.f = s + Math.min(Math.min(H.ar(b), H.ar(c)), s)
            a.e = true
        }
    },
    $S: 53
}
T.jY.prototype = {
    $2(a, b) {
        return a + b
    },
    $S: 15
}
T.x.prototype = {
    K(a, b) { }
}
T.aZ.prototype = {}
T.cB.prototype = {}
T.bH.prototype = {}
T.aB.prototype = {}
T.ah.prototype = {}
T.aV.prototype = {}
T.bq.prototype = {}
T.aF.prototype = {}
T.bd.prototype = {
    ar(a) {
        this.x.ar(a)
    },
    ga4() {
        return 1 / 0
    }
}
T.fY.prototype = {
    ga4() {
        return 1 / 0
    }
}
T.dT.prototype = {
    aq(a, b, c, d, e) {
        return this.x.aq(a, b, c, d, e)
    },
    ga4() {
        return this.r
    }
}
T.cA.prototype = {
    aD(a, b, c, d) {
        return this.x.aD(a, b, c, d)
    },
    ga4() {
        return 1 / 0
    }
}
T.ca.prototype = {
    aN(a, b, c, d) {
        return this.x.aN(a, b, c, d)
    },
    ga4() {
        return 1 / 0
    }
}
T.b8.prototype = {
    at(a, b) {
        return this.x.at(a, b)
    },
    ga4() {
        return 1 / 0
    }
}
T.cp.prototype = {
    b1(a, b, c, d) {
        this.x.b1(a, b, c, d)
        return false
    },
    ga4() {
        return 1 / 0
    }
}
T.bG.prototype = {}
T.Skill.prototype = {
    ao(a, b) {
        var s
        this.r = a
        s = 0
        if (b > s) this.f = b
        else this.f = s
    },
    W() { },
    b9(a) {
        var s = this.gap().z
        return a.fm(s.a.e, s.f)
    },
    as(a, b) {
        return true
    },
    a9(a, b, c) {
        return this.bx(a, b, c, false)
    },
    bx(a, b, c, d) {
        if (b)
            if (this.gap().y.a.Q > $.t()) return T.f_(a) * a.y.f.length * a.H
            else if (d) return T.f_(a) * a.M * a.H
            else return $.i() / T.f_(a) * a.N * a.H
        return c.gbo() + a.H
    },
    gb7() {
        return $.t()
    },
    gb8() {
        return $.B()
    },
    aa(a, b, c) {
        var s, r, q, p, o = this,
            n = b ? o.gb8() : o.gb7(),
            m = H.b([], t.L),
            l = 0,
            k = -n
        while (true) {
            if (!(l <= n && k <= n)) break
            c$0: {
                s = o.b9(c)
                if (s == null) return null
                if (!o.as(s, b)) {
                    ++k
                    break c$0
                }
                if (!C.Array.w(m, s)) {
                    m.push(s)
                    if (m.length >= n) break
                } else ++l
            }
        }
        if (m.length === 0) return null
        r = H.b([], t.F)
        for (q = m.length, p = 0; p < m.length; m.length === q || (0, H.F)(m), ++p) {
            s = m[p]
            r.push(new T.bG(s, o.a9(s, b, c)))
        }
        C.Array.bb(r, T.v5())
        return r
    },
    gap() {
        return this.r
    }
}
T.ActionSkill.prototype = {
    au(a, b) { // prob
        // this.level
        return (a.n() & 127) < this.f
    }
}
T.h8.prototype = {
    v(a, b, c, d) {
        var s, r, q, p, o = this,
            n = null,
            m = a[0].a
        if (b) {
            s = o.r
            s = s.dx > s.ch
        } else s = false
        if (s) {
            s = o.r
            r = C.JsInt.am(s.dx - s.ch, $.t())
            q = s.go
            if (q >= r) {
                s.go = q - r
                p = T.I(s, true, c)
                d.a.push(T.RunUpdate(LangData.get_lang("VQhA"), o.r, m, n, n, 0, 1000, 100))
                m.a3(p, true, o.r, T.ad(), c, d)
                return
            }
        }
        p = T.I(o.r, false, c)
        d.a.push(T.RunUpdate(LangData.get_lang("EYAn"), o.r, m, n, n, 0, 1000, 100))
        m.a3(p, false, o.r, T.oH(), c, d)
    }
}
T.hD.prototype = {
    v(a, b, c, d) {
        var s = a[0].a,
            r = T.I(this.r, false, c)
        d.a.push(T.RunUpdate(LangData.get_lang("EYAn"), this.r, s, null, null, 0, 1000, 100))
        s.a3(r, false, this.r, T.ad(), c, d)
    }
}
T.SklCounter.prototype = {
    W() {
        this.r.G.j(0, this)
    },
    aD(a, b, c, d) {
        var s = this
        if (b.y == s.r.z && (c.n() & 63) < s.r.fr) return
        if (s.ch === d) {
            if (s.Q && b != s.cx)
                if ((c.n() & 127) < s.f) s.cx = b
        } else {
            s.ch = d
            if (c.n() < s.f) {
                s.cx = b
                s.Q = true
                d.b.push(s.gdr())
            }
        }
    },
    f8(a, b) {
        var s, r, q, p = this
        p.Q = false
        p.ch = null
        if (p.cx.fx > 0 && p.r.bw(a)) {
            s = T.I(p.r, false, a)
            r = $.K()
            q = b.a
            q.push(r)
            q.push(T.RunUpdate(C.String.B(LangData.get_lang("VgaN"), $.qw()), p.r, p.cx, null, null, $.i(), 1000, 100))
            p.cx.a3(s, false, p.r, T.ad(), a, b)
        }
    },
    $iah: 1
}
T.SklDefend.prototype = {
    ga4() {
        return $.pl()
    },
    aq(a, b, c, d, e) {
        if (d.n() < this.f && this.r.bw(d)) {
            e.a.push(T.RunUpdate(LangData.get_lang("NIMn"), this.r, b, null, null, $.bg(), 1000, 100))
            return C.JsInt.P(a, $.t())
        }
        return a
    },
    W() {
        this.r.y2.j(0, this)
    },
    $iaB: 1
}
T.SklHide.prototype = {
    W() {
        var s = this
        s.r.G.j(0, s)
        s.r.x1.j(0, s.Q)
    },
    aD(a, b, c, d) {
        var s = this,
            r = s.f,
            q = 0
        if (r <= q || s.ch.a != null) return
        r = s.r
        if (r.fx > q && !r.A && r.z.f.length > $.i() && (c.n() & 63) < s.f) {
            s.r.rx.j(0, s.ch)
            s.r.F()
            r = LangData.get_lang("oIIa")
            q = s.r
            d.a.push(T.RunUpdate(r, q, q, null, null, $.Z(), 1000, 100))
        }
    },
    aN(a, b, c, d) {
        var s = this.ch
        if (s.a != null) {
            s.D()
            this.r.F()
        }
    },
    ar(a) {
        var s, r, q, p = this.r
        p.H = p.H / $.Z()
        s = this.f
        r = $.b2()
        if (s > r) {
            q = s - r
            p.db = p.db + q
            p.cx = p.cx + q
            p.dy = p.dy + q
        }
    },
    $iah: 1
}
T.fC.prototype = {
    gT() {
        return 0
    }
}
T.SklMerge.prototype = {
    W() {
        this.r.S.j(0, this)
    },
    bS(a, b, c) {
        var s, r, q, p, o, n, m, l, k = this,
            j = null
        if ((b.n() & 63) < k.f) {
            for (s = 0, r = k.r.q, q = r.length, p = a.q, o = false; s < q; ++s) {
                n = p[s]
                if (n > r[s]) {
                    r[s] = n
                    o = true
                }
            }
            s = 0
            r = a.k1
            while (true) {
                q = k.r.k1
                if (!(s < q.length && s < r.length)) break
                m = q[s]
                l = r[s]
                q = J.uR(m)
                if (q.gcw(m) !== q.gcw(m)) break
                q = l.f
                p = m.f
                if (q > p) {
                    if (p === 0) {
                        m.f = q
                        if (m instanceof T.ActionSkill) k.r.k4.push(m)
                        m.W()
                    } else m.f = q
                    o = true
                } ++s
            }
            r = a.go
            q = k.r
            if (r > q.go) {
                q.go = r
                a.go = 0
            }
            r = a.l
            p = q.l
            if (r > p) {
                q.l = p + r
                a.l = 0
            }
            if (o) {
                a.r2.m(0, $.iJ(), new T.fC())
                k.r.F()
                r = c.a
                r.push($.K())
                r.push(T.RunUpdate(LangData.get_lang("yGkN"), k.r, a, j, j, $.a6(), $.d0(), 100))
                q = LangData.get_lang("PGSN")
                p = new T.MPlr()
                p.cO(k.r)
                r.push(T.RunUpdate(q, p, a, j, j, 0, 1000, 100))
                return true
            }
        }
        return false
    },
    $ify: 1
}
T.dV.prototype = {
    gT() {
        return 0
    },
    dG(a) {
        var s, r, q, p, o, n = this
        for (s = n.x, r = n.r, q = r.r2; s.length !== 0;) {
            p = a.b5(s)
            if (p.r.z == r.y && (a.n() & 127) < p.f && p.r.bw(a)) {
                p.cI(a)
                return p
            } else {
                C.Array.U(s, p)
                if (s.length === 0) {
                    o = n.a
                    if (o != null) {
                        n.b.sbq(n.c)
                        n.c.saE(n.b);
                        --o.a
                        n.a = null
                    }
                    q.U(0, $.d6())
                }
                p.Q = null
            }
        }
        return null
    },
    fs(a) {
        var s = this.x
        C.Array.U(s, a)
        if (s.length === 0) {
            this.D()
            this.r.r2.U(0, $.d6())
        }
    },
    dv(a, b, c, d, e, f, g) {
        var s, r, q, p = this.dG(f)
        if (p != null) {
            s = p.r
            g.a.push(T.RunUpdate(LangData.get_lang("JzmA"), s, d, null, null, $.bg(), 1000, 100))
            a = s.du(a, b, c, e, f, g)
            r = $.ao()
            if (a == r) return r
            q = T.d9(s, b, f)
            s.aF(s.aq(C.d.eW(a * $.b0() / q), c, e, f, g), c, e, f, g)
            return $.ao()
        }
        return a
    }
}
T.SklProtect.prototype = {
    b9(a) {
        var s = this.r
        return a.fk(s.z.f, s)
    },
    as(a, b) {
        return !(a instanceof T.aM)
    },
    a9(a, b, c) {
        var s, r
        if (b) {
            s = $.i()
            r = t.Q.a(a.r2.h(0, $.d6()))
            if (r != null) s = r.x.length + $.i()
            return $.i() / T.f_(a) * a.N / s
        }
        return c.gbo()
    },
    cI(a) {
        var s, r, q = this,
            p = q.aa(0, (a.n() & 127) < q.r.fr, a),
            o = p != null ? p[0].a : null,
            n = q.Q
        if (n == o) return
        if (n != null) {
            s = t.Q.a(n.r2.h(0, $.d6()))
            if (s != null) s.fs(q)
        }
        q.Q = o
        if (o != null) {
            n = o.r2
            r = t.Q.a(n.h(0, $.d6()))
            if (r == null) {
                r = new T.dV(o, H.b([], t.gN))
                n.m(0, $.d6(), r)
                o.y1.j(0, r)
            }
            r.x.push(q)
        }
    },
    at(a, b) {
        this.cI(a)
        return false
    },
    W() {
        this.r.x2.j(0, this)
    },
    $ibq: 1
}
T.SklReflect.prototype = {
    dv(a, b, c, d, e, f, g) {
        var s, r, q = this
        if (c.fx <= 0) return a
        if (f.n() < q.f && f.n() < 128 && q.r.bw(f)) {
            s = T.I(q.r, true, f) * $.b0()
            if (s > a) s = a
            g.a.push(T.RunUpdate(C.String.B(LangData.get_lang("lnNA"), $.qI()), q.r, c, null, null, $.as(), $.d0(), 100))
            c.a3(s, true, q.r, e, f, g)
            r = q.r
            r.l = r.l - $.mY()
            return $.ao()
        }
        return a
    },
    W() {
        this.r.y1.j(0, this)
    },
    $ibH: 1
}
T.SklReraise.prototype = {
    ga4() {
        return $.lG()
    },
    b1(a, b, c, d) {
        var s, r, q, p = this,
            o = c.n(),
            n = p.f
        if ((o & 127) < n) {
            p.f = C.JsInt.P(n + $.i(), $.t())
            o = C.String.B(LangData.get_lang("DWRn"), $.ng())
            n = p.r
            s = d.a
            s.push(T.RunUpdate(o, n, n, null, null, $.b3(), $.d0(), 100))
            p.r.fx = (c.n() & 15) + 1
            n = LangData.get_lang("imin")
            o = p.r
            r = new T.HPlr(0)
            r.a = o.e
            q = o.fx
            r.d = q
            s.push(T.RunUpdate(n, o, r, new T.HRecover(q), null, 0, 1000, 100))
            return true
        }
        return false
    },
    W() {
        this.r.L.j(0, this)
    },
    $iaF: 1
}
T.e0.prototype = {
    ga4() {
        return $.pP()
    },
    gT() {
        var s = this.x,
            r = 0
        if (s > r) return $.i()
        return r
    },
    aq(a, b, c, d, e) {
        var s = this.x,
            r = 0
        if (s == r) return a
        if (a > s) {
            this.x = r
            a -= r
        } else {
            this.x = s - a
            a = r
        }
        return a
    },
    K(a, b) {
        this.D()
        this.r.r2.U(0, $.lR())
    }
}
T.SklShield.prototype = {
    aN(a, b, c, d) {
        var s, r, q, p = this
        if (p.f > 0) {
            s = t.eb.a(p.r.r2.h(0, $.lR()))
            if (s == null) {
                r = p.r
                s = new T.e0(r, 0)
                r.r2.m(0, $.lR(), s)
                p.r.y2.j(0, s)
            }
            r = p.f
            q = s.x
            if (r >= q) s.x = q + (c.ax($.i() + C.JsInt.P(r * $.B(), $.C())) + $.i())
        }
        return a
    },
    W() {
        this.r.x1.j(0, this)
    },
    $iaV: 1
}
T.SklUpgrade.prototype = {
    W() {
        this.r.G.j(0, this)
    },
    aD(a, b, c, d) {
        var s, r, q = this,
            p = null,
            o = q.f,
            n = 0
        if (o <= n || q.Q.a != null) return
        s = $.aR()
        r = $.b2()
        if (o > r) s += o - r
        o = q.r.fx
        if (o > n && o < s + (c.n() & 63) && (c.n() & 63) < q.f) {
            q.r.r2.m(0, $.nl(), q)
            q.r.rx.j(0, q.Q)
            q.r.F()
            o = d.a
            o.push($.K())
            n = LangData.get_lang("TRcn")
            r = q.r
            o.push(T.RunUpdate(n, r, r, p, p, $.a6(), $.d0(), 100))
            r = C.String.B(LangData.get_lang("iTtn"), $.qK())
            n = q.r
            o.push(T.RunUpdate(r, n, n, p, p, 0, 1000, 100))
            n = q.r
            n.l = n.l + $.lM()
        }
    },
    gT() {
        return $.i()
    },
    K(a, b) {
        var s, r = this
        r.r.r2.U(0, $.nl())
        r.Q.D()
        r.r.F()
        if (r.r.fx > 0) {
            s = b.a
            s.push($.K())
            s.push(T.aO(LangData.get_lang("Ebza"), a, r.r))
        }
    },
    ar(a) {
        var s = this.r,
            r = s.ch,
            q = $.lI()
        s.ch = r + q
        s.cx = s.cx + q
        s.db = s.db + q
        s.dx = s.dx + q
        s.dy = s.dy + q
        q = s.cy
        r = $.as()
        s.cy = q + r
        s.fr = s.fr + r
    },
    $ix: 1,
    $iah: 1
}
T.SkillVoid.prototype = {
    ao(a, b) {
        this.r = a
        this.f = 0
    },
    au(a, b) {
        return false
    },
    aa(a, b, c) {
        return null
    },
    v(a, b, c, d) {
        return
    }
}
T.fX.prototype = {
    gap() {
        return this.aj.r
    },
    ac() {
        this.k3 = T.SklAttack(this)
    },
    aU() {
        var s, r
        this.bB()
        s = this.q
        r = 0
        s[r] = r
        s[$.a4()] = r
        r = $.ap()
        s[r] = C.d.P(s[r], $.t())
    }
}
T.hY.prototype = {
    gT() {
        return 0
    }
}
T.SklZombie.prototype = {
    W() {
        this.r.S.j(0, this)
    },
    bS(a6, a7, a8) {
        var s, r, q, p, o, n, m, l, k, j, i, h, g, f, e, d, c, b, a, a0, a1, a2, a3, a4 = this,
            a5 = null
        if (!(a6 instanceof T.aM) && (a7.n() & 63) < a4.f && a4.r.bw(a7)) {
            a6.r2.m(0, $.iJ(), new T.hY())
            s = H.as_string(a4.r.a) + "?" + H.as_string($.qZ())
            r = a4.r
            q = r.b
            r = r.c
            p = 0
            o = $.T()
            n = H.b([], t.q)
            m = H.b([], t.H)
            l = P.a0(t.X, t.W)
            k = new Sgls.c(t.n)
            k.c = k
            k.b = k
            j = new Sgls.c(t.p)
            j.c = j
            j.b = j
            i = new Sgls.c(t.g)
            i.c = i
            i.b = i
            h = new Sgls.c(t.G)
            h.c = h
            h.b = h
            g = new Sgls.c(t._)
            g.c = g
            g.b = g
            f = new Sgls.c(t.e)
            f.c = f
            f.b = f
            e = new Sgls.c(t.k)
            e.c = e
            e.b = e
            d = new Sgls.c(t.l)
            d.c = d
            d.b = d
            c = new Sgls.c(t.m)
            c.c = c
            c.b = c
            b = t.i
            a = H.b([], b)
            a0 = H.b([], b)
            a1 = H.b([], b)
            b = H.b([], b)
            a2 = 0
            a3 = new T.fX(s, q, r, a5, p, o, n, m, l, k, j, i, h, g, f, e, d, c, a, a0, a1, b, a2, a2, a2, $.W(), a2)
            a3.a1(s, q, r, a5)
            a3.a6 = new T.cp(a3)
            a3.aj = a4
            a3.e = T.fD(a4.r)
            a3.r = LangData.get_lang("KYSn")
            r = a4.r
            a3.y = r.y
            r.L.j(0, a3.a6)
            a3.az()
            a3.l = a7.n() * $.C()
            a4.r.y.aZ(a3)
            r = a8.a
            r.push($.K())
            r.push(T.RunUpdate(LangData.get_lang("apma"), a4.r, a6, a5, a5, $.a6(), $.d0(), 100))
            q = LangData.get_lang("kXba")
            s = a4.r
            a2 = a3.fx
            b = new T.HPlr(a2)
            b.a = a3.e
            b.d = a2
            r.push(T.RunUpdate(q, s, b, a6, H.b([a6], t.j), 0, 1000, 100))
            return true
        }
        return false
    },
    $ify: 1
}
T.j2.prototype = {
    b3(a) {
        a.dB(0, LangData.fZ(this.c.e), $.t())
        this.cN(a)
    },
    cB(a, b, c, d) {
        var s, r, q, p, o, n, m, l, k = c[d],
            j = a[d],
            i = d + $.i(),
            h = c[i]
        i = a[i]
        s = d + $.t()
        r = c[s]
        s = a[s]
        for (q = 0, p = q; p < $.B(); ++p) {
            o = d + p
            n = c[o]
            m = b[o]
            l = n - m
            if (l > q) b[o] = m + l
            else {
                n = $.at()
                if (m < n) b[o] = m + n
            }
        }
        return Math.abs(k - j) + Math.abs(h - i) + Math.abs(r - s)
    },
    bn() {
        var s = this,
            r = s.c
        s.cB(r.E, r.t, s.d, $.ap())
        s.dW()
    }
}
T.hg.prototype = {
    au(a, b) {
        var s = this.fx
        if (s != null && s.fx > 0)
            if (b) return s.y != this.r.y
            else return a.n() < 128
        return false
    },
    W() {
        this.r.G.j(0, this.fr)
    },
    aa(a, b, c) {
        return H.b([], t.F)
    },
    v(a, b, c, d) {
        var s, r, q, p = this
        d.a.push(T.RunUpdate(LangData.get_lang("NbSn"), p.r, p.fx, null, null, $.as(), 1000, 100))
        s = p.fx
        s.aF(s.fx, p.r, T.ad(), c, d)
        s = p.r
        s.cy = s.cy - $.cX()
        r = s.go
        q = 0
        if (r > q) s.go = q
        p.fx = null
    },
    aD(a, b, c, d) {
        var s
        if (a > 0) {
            s = this.r
            s = b != s && T.bW(b.fr + b.dy, s.fr + s.dx, c)
        } else s = false
        if (s) this.fx = b
    }
}
T.eo.prototype = {
    b6() {
        var s, r = new T.hg(0)
        r.e = true
        r.fr = new T.cA(r)
        s = this.c
        r.ao(s, $.i())
        s.k1.push(r)
        s = s.k2;
        (s && C.Array).j(s, r)
    }
}
T.fl.prototype = {
    gT() {
        return 0
    },
    K(a, b) { },
    $ix: 1
}
T.jq.prototype = {
    b3(a) { },
    bn() { },
    b6() {
        this.c.r2.m(0, $.a7(), new T.fl())
    }
}
T.jN.prototype = {
    b3(a) { },
    bn() { },
    b6() { }
}
T.k1.prototype = {
    cs() {
        var s, r = this.c,
            q = r.q,
            p = H._arrayInstanceType(q).i("y<1,l*>")
        p = this.r = P.List_List_of(new H.y(q, new T.k3(), p), true, p.i("M.E"))
        r = r.q
        q = $.ap()
        r = r[q]
        s = $.r5()
        if (r < s) p[q] = s - r
        else p[q] = 0
        this.dV()
    },
    b6() {
        var s, r, q, p, o, n, m, l = this.c
        l.rx.j(0, new T.h1())
        // Rinick
        if (l.e != $.iL()) {
            for (l = l.k2, s = l.length, r = 0; r < l.length; l.length === s || (0, H.F)(l), ++r) {
                q = l[r]
                p = q.f
                if (p == 0) {
                    q.f = $.C()
                    q.W()
                } else q.f = C.JsInt.ez(p, $.i())
            }
            return
        }
        lst = [0, 2, 15, 18, 27, 28, 32, 37, 38]
        // for (s = [0, $.t(), $.eT(), $.iH(), $.pu(), $.iI(), $.at(), $.pH(), $.lL()], r = 0; r < 9; ++r) {
        for (s = lst, r = 0; r < 9; ++r) {
            o = s[r]
            q = l.k2[o]
            if (q.f == 0) {
                q.f = $.av()
                q.W()
            } else H.ve(J.b4(o))
        }
        for (s = l.k2, p = s.length, r = 0; r < s.length; s.length === p || (0, H.F)(s), ++r) {
            q = s[r]
            if (!(q instanceof T.ActionSkill)) {
                n = q.f
                if (n == 0) {
                    q.f = $.aR()
                    q.W()
                } else q.f = n + $.aR()
            }
        }
        m = new T.e2(0)
        m.ao(l, $.as())
        s = l.k1
        s.push(m)
        p = l.k2;
        (p && C.Array).j(p, m)
        m = new T.eg(0)
        m.ao(l, $.Z())
        s.push(m)
        p = l.k2;
        (p && C.Array).j(p, m)
        m = new T.hy($.t(), 0)
        m.r = l
        $.av()
        s.push(m)
        s = l.k2;
        (s && C.Array).j(s, m)
        m.r.L.j(0, m)
        l.x1.j(0, new T.h0(l))
    }
}
T.k3.prototype = {
    $1(a) {
        return $.b2() - a
    },
    $S: 2
}
T.h0.prototype = {
    ga4() {
        return $.ao()
    },
    aN(a, b, c, d) {
        var s, r, q, p, o = {}
        o.a = false
        s = this.r
        s.r2.aw(0, new T.k2(o))
        if (o.a) {
            o = d.a
            r = o.length
            s.bL(s, d)
            if (o.length !== r) {
                // weaponRModifierUse
                // [0]使用[属性修改器]
                C.Array.co(o, r, T.RunUpdate(LangData.get_lang("UeyA"), s, null, null, null, $.a6(), 1000, 100))
                o.push($.K())
            }
        }
        o = s.y
        q = o.a.e.length
        o = o.f.length
        p = C.JsInt.am(q - o, $.i()) - o
        o = 0
        if (p > o) {
            q = new T.ee(p, o)
            q.ao(s, o)
            return q
        }
        return a
    }
}
T.k2.prototype = {
    $2(a, b) {
        if (b.gT() < 0) this.a.a = true
    },
    $S: 16
}
T.h1.prototype = {
    ga4() {
        return $.ao()
    },
    ar(a) {
        var s = a.q,
            r = 0,
            q = s[r],
            p = $.b2()
        if (q < p) {
            s[r] = p
            a.ch = p
        }
        r = $.i()
        if (s[r] < p) {
            s[r] = p
            a.cx = p
        }
        r = $.t()
        if (s[r] < p) {
            s[r] = p
            a.cy = p + $.eU()
        }
        r = $.B()
        if (s[r] < p) {
            s[r] = p
            a.db = p
        }
        r = $.C()
        if (s[r] < p) {
            s[r] = p
            a.dx = p
        }
        r = $.X()
        if (s[r] < p) {
            s[r] = p
            a.dy = p
        }
        r = $.a4()
        if (s[r] < p) {
            s[r] = p
            a.fr = p
        }
    }
}
T.ee.prototype = {
    v(a, b, c, d) {
        var s, r, q, p, o, n, m, l, k = this,
            j = null
        k.r.l = c.n() * $.C() + $.cX()
        s = d.a
        // weaponRModifierUse
        // [0]使用[属性修改器]
        s.push(T.RunUpdate(LangData.get_lang("UeyA"), k.r, j, j, j, $.a6(), 1000, 100))
        for (r = 0, q = k.fr; r < q; ++r) {
            p = T.nU(k.r)
            p.y = k.r.y
            p.az()
            p.l = c.n() * $.C() + $.cX()
            k.r.y.aZ(p)
            s.push($.K())
            // sklCloned
            // 出现一个新的[1]
            o = LangData.get_lang("pKQn")
            n = k.r
            m = p.fx
            l = new T.HPlr(m)
            l.a = p.e
            l.d = m
            m = new T.aX(0, 1000, 100, o, n, l, j, j)
            m.aK(o, n, l, j, j, 0, 1000, 100)
            s.push(m)
        }
    }
}
T.hy.prototype = {
    dA(a, b) {
        C.Array.sp(this.r.q, 0)
        this.r.aU()
        this.r.cn()
    },
    dd(a, b) {
        var s, r, q = this.r.y,
            p = q.a.e.length
        q = q.f.length
        s = C.JsInt.am(p - q, $.i()) - q
        if (s > 0) {
            b.a.push($.K())
            r = new T.ee(s, 0)
            r.ao(this.r, $.i())
            r.v(H.b([], t.F), true, a, b)
        }
    }
}
T.hz.prototype = {
    au(a, b) {
        if (this.f == 0) return false
        return (a.n() & 63) + this.f > this.r.fr
    },
    aa(a, b, c) {
        return H.b([], t.F)
    },
    v(a, b, c, d) {
        var s, r, q, p, o = this,
            n = null,
            m = 1000,
            l = d.a
        l.push(T.RunUpdate(LangData.get_lang("Rdya"), o.r, n, n, n, 0, m, 100))
        if (c.n() < 64) {
            l.push(T.RunUpdate(LangData.get_lang("ibDN"), o.r, n, n, n, 0, m, 100))
            o.fr = o.fr - 1
        } else {
            s = c.ax($.ap())
            r = (c.n() & 31) + $.a4()
            q = o.r
            p = q.q
            p[s] = p[s] + r
            q.F()
            l.push(T.RunUpdate("[" + H.as_string($.r6()[s]) + "]" + LangData.get_lang("zbya"), o.r, n, r, n, 0, m, 100))
        }
        q = o.r
        q.l = q.l + $.cX()
        q = o.fr - (c.n() & 3)
        o.fr = q
        if (q <= 0) {
            l.push(T.RunUpdate(LangData.get_lang("ToLa"), o.r, n, n, n, 0, m, 100))
            if (o.f < $.as()) {
                l.push(T.RunUpdate(LangData.get_lang("BcJa"), o.r, n, n, n, 0, m, 100))
                o.f = 0
            } else {
                l.push(T.RunUpdate(LangData.get_lang("kHPN"), o.r, n, n, n, 0, m, 100))
                o.f = $.i()
            }
            o.r.aF((c.n() & 31) + $.aR(), o.r, T.ad(), c, d)
        }
    }
}
T.kb.prototype = {
    $1(a) {
        return J.rD(a)
    },
    $S: 55
}
T.ep.prototype = {
    b3(a) {
        var s, r
        this.cN(a)
        s = $.p2()
        r = 0
        this.r = H.b([s, r, s, r, r, r, r, r], t.i)
    },
    b6() {
        var s = this.c,
            r = s.k2,
            q = new T.hz($.B(), 0)
        q.e = true
        q.ao(s, $.d1());
        (r && C.Array).j(r, q)
    }
}
T.Weapon.prototype = {
    b3(a) {
        var s, r, q, p, o, n, m, l, k, j, i, h, g, this_ = this,
            e = a.c
        e.toString
        s = H._arrayInstanceType(e).i("y<1,l*>")
        this_.d = P.List_List_of(new H.y(e, new T.ko(), s), true, s.i("M.E"))
        this_.e = a.ax($.bg())
        r = a.ax($.av())
        e = $.a4()
        s = this_.d
        q = s && C.Array
        if (r === e) {
            p = q.al(s, $.bg(), $.aI())

        } else {
            e = q.al(s, $.bg(), $.aI())
            s = H._arrayInstanceType(e).i("y<1,l*>")
            p = P.List_List_of(new H.y(e, new T.kp(), s), true, s.i("M.E"))
            p[r] = $.iH()
        }
        o = 0
        for (e = p.length, n = o, m = n, l = 0; l < e; ++l) {
            k = p[l]
            if (k > o) {
                ++n
                m += k
            }
        }
        m *= $.B()
        e = this_.d
        j = (e && C.Array).al(e, o, $.av())
        C.Array.aJ(j)
        i = j[$.i()] + j[$.C()] + n
        for (k = 0, h = i; e = $.ap(), k < e; ++k) {
            g = C.d.P(i * p[k], m)
            h -= g * $.B()
            this_.r[k] = g
        }
        if (p[e] > 0) this_.r[e] = h
    },
    cB(a, b, c, d) {
        var s, r, q, p, o, n, m = c[d] - a[d],
            l = $.i(),
            k = d + l,
            j = c[k] - a[k]
        k = $.t()
        s = d + k
        r = c[s] - a[s]
        s = 0
        if (m > s && j > s && r > s) {
            q = d + C.JsInt.V(m + j + r + $.q8(), $.B())
            p = c[q]
            o = b[q]
            n = C.d.P(p - o, k) + l
            if (n > s) b[q] = o + n
        }
        return Math.abs(m) + Math.abs(j) + Math.abs(r)
    },
    bn() {
        // preUpgrade
        var s, r, q, p = this,
            o = 0
        for (s = $.Z(), r = p.c; s < $.d1(); s += $.B()) {
            o += p.cB(r.E, r.t, p.d, s)
        }
        r = C.JsInt.P($.mY() - o, $.a4())
        p.f = r
        q = 0
        if (r < q) {
            p.f = q
        }
    },
    cs() {
        // postUpgrade
        var s, r, q
        for (s = 0, r = this.c; s < $.av(); ++s) {
            q = r.q
            q[s] = q[s] + this.r[s]
        }
        this.b6()
    },
    b6() {
        // upgradeSkill
        var s = this.c.k1[this.e],
            r = s.f
        if (r == 0) s.e = true
        s.f = r + this.f
    }
}
T.kq.prototype = {
    $2(a, b) {
        var s = new T.ep(a, b, P.aL($.av(), 0, false, t.B))
        s.a = a
        return s
    },
    $S: 56
}
T.kr.prototype = {
    $2(a, b) {
        var s = new T.eo(a, b, P.aL($.av(), 0, false, t.B))
        s.a = a
        return s
    },
    $S: 57
}
T.ks.prototype = {
    $2(a, b) {
        var s
        // Rinick
        if (b.b == $.iL()) {
            s = new T.k1(a, b, P.aL($.av(), 0, false, t.B))
            s.a = a
            return s
        } else return T.NoWeapon(a, b)
    },
    $S: 7
}
T.kt.prototype = {
    $2(a, b) {
        var s
        if (C.Array.w($.r1(), b.b)) {
            s = new T.jq(a, b, P.aL($.av(), 0, false, t.B))
            s.a = a
            return s
        } else return T.NoWeapon(a, b)
    },
    $S: 7
}
T.ku.prototype = {
    $2(a, b) {
        var s
        if (C.Array.w($.rk(), b.b)) {
            s = new T.kv(a, b, P.aL($.av(), 0, false, t.B))
            s.a = a
            return s
        } else return T.NoWeapon(a, b)
    },
    $S: 7
}
T.ko.prototype = {
    $1(a) {
        return (a & $.b2()) >>> 0
    },
    $S: 2
}
T.kp.prototype = {
    $1(a) {
        if (a > $.pN()) return a - $.b1()
        return 0
    },
    $S: 2
}
T.hc.prototype = {
    aD(a, b, c, d) {
        var s = this
        if (b.y == s.r.z) return
        if (s.ch === d) {
            if (s.Q && b != s.cx) s.cx = b
        } else {
            s.ch = d
            s.cx = b
            s.Q = true
            d.b.push(s.gdr())
        }
    }
}
T.kv.prototype = {
    b3(a) { },
    bn() { },
    b6() {
        var s = new T.hc(0),
            r = this.c
        s.ao(r, $.i())
        r.k1.push(s)
    }
}
T.ij.prototype = {}
T.ik.prototype = {}
LangData.SuperRC4.prototype = {
    dB(a, b, c) {
        // init rc4
        var s, r, q, p, o, n, m = b.length
        for (s = this.c, r = 0; r < c; ++r)
            for (q = 0, p = 0; p < 256; ++p) {
                o = b[C.JsInt.V(p, m)]
                n = s[p]
                q = q + n + o & 255
                s[p] = s[q]
                s[q] = n
            }
        this.a = this.b = 0
    },
    dH(a, b) {
        var s, r, q, p, o, n, m = a.length
        if (m <= 1) return a
        s = H.b([], t.i)
        C.Array.sp(s, m)
        for (r = 0; r < m; ++r) s[r] = r
        for (q = 0, r = 0; r < 2; ++r)
            for (p = 0; p < m; ++p) {
                o = this.ax(m)
                n = s[p]
                q = C.JsInt.V(q + n + o, m)
                s[p] = s[q]
                s[q] = n
            }
        m = t.fh.aL(b.i("0*")).i("y<1,2>")
        // return X.map((e) => list[e]).toList();
        return P.List_List_of(new H.y(s, new LangData.k_(a, b), m), true, m.i("M.E"))
    },
    fi(a) {
        var s = a.length
        if (s === 1) return a[0]
        else if (s > 1) return a[this.ax(s)]
        return null
    },
    b5(a) {
        return this.fi(a, t.z)
    },
    fj(a, b) {
        var s, r, q = a.length
        if (q === 1) {
            // if (!J.Y(a[0], b)) return a[0]
            if (a[0] !== b) return a[0]
        } else if (q > 1) {
            s = C.Array.aT(a, b)
            if (s < 0) return a[this.ax(a.length)]
            r = this.ax(a.length - 1)
            return a[r >= s ? r + 1 : r]
        }
        return null
    },
    fk(a, b) {
        return this.fj(a, b, t.z)
    },
    fl(a, b) {
        var s, r, q, p, o = b.length
        if (o === 0) return this.b5(a)
        s = C.Array.geT(b)
        r = b.length
        if (a.length > r) {
            q = C.Array.aT(a, s)
            p = this.ax(a.length - r)
            return a[p >= q ? p + r : p]
        }
        return null
    },
    fm(a, b) {
        return this.fl(a, b, t.z)
    },
    gbo() {
        return (this.n() << 8 | this.n()) >>> 0
    },
    ax(a) {
        var s, r
        if (a === 0) return 0
        s = this.n()
        r = a
        do {
            s = (s << 8 | this.n()) >>> 0
            if (s >= a) s = C.JsInt.V(s, a)
            r = C.JsInt.am(r, 8)
        } while (r !== 0)
        return s
    }
}
LangData.k_.prototype = {
    $1(a) {
        return this.a[a]
    },
    $S() {
        return this.b.i("0*(l*)")
    }
};
(function aliases() {
    // MARK: 类型别名
    var s = J.Interceptor.prototype
    s.dO = s.k

    s = J.bE.prototype
    s.dQ = s.k

    s = P.L.prototype
    s.dP = s.bV

    s = W.Element.prototype
    s.bY = s.aA

    s = W.eD.prototype
    s.dX = s.aM

    s = T.cz.prototype
    s.cM = s.a7

    s = T.Plr.prototype
    s.bB = s.aU
    s.dS = s.bP
    s.dR = s.bs
    s.dT = s.F

    s = T.Skill.prototype
    s.bC = s.a9
    s.bZ = s.bx
    s.dU = s.aa

    s = T.ActionSkill.prototype
    s.aX = s.au

    s = T.Weapon.prototype
    s.cN = s.b3
    s.dW = s.bn
    s.dV = s.cs
})();
(function installTearOffs() {
    // MARK: 静态实例
    var static_2 = hunkHelpers._static_2,
        static_1 = hunkHelpers._static_1,
        static_0 = hunkHelpers._static_0,
        instance_2u = hunkHelpers._instance_2u,
        install_static_tearoff = hunkHelpers.installStaticTearOff,
        instance_1i = hunkHelpers._instance_1i,
        instance_0i = hunkHelpers._instance_0i,
        instance_1u = hunkHelpers._instance_1u,
        install_instance_tear_off = hunkHelpers.installInstanceTearOff,
        instance_0u = hunkHelpers._instance_0u
    static_2(J, "bO", "t1", 59)
    static_1(H, "uv", "mv", 10)
    static_1(P, "uK", "_AsyncRun__scheduleImmediateJsOverride", 4)
    static_1(P, "uL", "_AsyncRun__scheduleImmediateWithSetImmediate", 4)
    static_1(P, "uM", "_AsyncRun__scheduleImmediateWithTimer", 4)
    static_0(P, "ow", "uD", 0)
    static_2(P, "uN", "ux", 9)
    instance_2u(P._Future.prototype, "geg", "be", 9)
    install_static_tearoff(W, "uV", 4, null, ["$4"], ["tT"], 20, 0)
    install_static_tearoff(W, "uW", 4, null, ["$4"], ["tU"], 20, 0)
    static_2(HtmlRenderer, "oD", "rU", 62)

    let html_holder
    instance_1i(html_holder = HtmlRenderer.inner_render.prototype, "gfb", "fc", 31)
    instance_1i(html_holder, "gff", "ds", 8)
    instance_0i(html_holder, "gbc", "dI", 0)
    instance_1u(html_holder, "gfd", "fe", 33)
    install_instance_tear_off(html_holder, "gel", 0, 0, null, ["$1", "$0"], ["c5", "em"], 34, 0, 0)
    instance_0u(html_holder = T.Plr.prototype, "gfJ", "fK", 19)
    instance_0u(html_holder, "gbT", "dE", 19)

    static_1(Sgls, "vg", "tv", 8)
    install_static_tearoff(T, "v6", 5, null, ["$5"], ["ty"], 1, 0)
    install_static_tearoff(T, "v7", 5, null, ["$5"], ["tA"], 1, 0)
    install_static_tearoff(T, "v9", 5, null, ["$5"], ["tC"], 1, 0)
    install_static_tearoff(T, "oI", 5, null, ["$5"], ["tD"], 1, 0)
    install_static_tearoff(T, "oJ", 5, null, ["$5"], ["tE"], 1, 0)
    install_static_tearoff(T, "mE", 5, null, ["$5"], ["tF"], 1, 0)
    install_static_tearoff(T, "vb", 5, null, ["$5"], ["tI"], 1, 0)
    install_static_tearoff(T, "v8", 5, null, ["$5"], ["tB"], 1, 0)
    install_static_tearoff(T, "va", 5, null, ["$5"], ["tG"], 1, 0)
    static_2(T, "v4", "rT", 63)
    static_2(T, "mD", "nX", 64)
    static_2(T, "v5", "t6", 43)
    install_static_tearoff(T, "ad", 5, null, ["$5"], ["tx"], 1, 0)
    install_static_tearoff(T, "oH", 5, null, ["$5"], ["tz"], 1, 0)
    install_instance_tear_off(T.dl.prototype, "gf9", 0, 5, null, ["$5"], ["fa"], 1, 0, 0)
    instance_2u(T.SklCounter.prototype, "gdr", "f8", 54)
})();
(function inheritance() {
    // MARK: 继承链
    var mixin = hunkHelpers.mixin,
        inherit = hunkHelpers.inherit,
        inherit_many = hunkHelpers.inheritMany
    inherit(P.Object, null)
    inherit_many(P.Object,
        [H.m8, J.Interceptor, J.db, P.O, P.ev, P.L, H.cv, P.fv, H.du, H.hV, H.kh, H.jR, H.dt, H.eE, H.c_, P.aU, H.jK, H.fA,
        H.JSSyntaxRegExp, H.ew, H.kz, H.bK, H.l3, H.Rti, H.ib, H.iu,
        P.l8, P.i_, P.f3, P.i4, P.cN,
        P._Future, P.i0, P.em, P.hO, P.hP, P.im, P.i1, P.i3, P.i7, P.ii, P.io, P.lf, P.eM, P.kV, P.ie, P.z, P.dY, P.fg, P.js, P.lc, P.lb, P.dq,
        P.Duration, P.fM, P.el, P.kG, P.jm, P.N, P.iq, P.cH,
        W.j8, W.m5, W.cP, W.cr, W.dN, W.eD, W.is, W.dv, W.kE, W.l_, W.ix,
        P._StructuredClone, P.kw, P.eJ, P.jQ, P.kT, Y.RC4, L.ProfileWinChance, V.ProfileMain, X.ProfileFind,
        S.fK,
        HtmlRenderer.inner_render, HtmlRenderer.jT, HtmlRenderer.ax,
        Sgls.a_, Sgls.n,
        T.x, T.Plr, T.dk, T.fo, T.b7, T.IPlr, T.HDamage, T.HRecover, T.aX, T.aq, T.bG, T.Weapon, T.fl
        ]
    )
    inherit_many(J.Interceptor, [J.fw, J.cs, J.bE, J.JsArray, J.JsNumber, J.JsString, H.dJ, H.ab, W.fn, W.Blob, W.CanvasRenderingContext2D, W.i6, W.bb, W.ja, W.jb, W.o, W.c4, W.jL, W.ig, W.il, W.iy, W.iA])
    inherit_many(J.bE, [J.PlainJavaScriptObject, J.UnknownJavaScriptObject, J.JavaScriptFunction])
    inherit(J.JsUnmodifiableArray, J.JsArray)
    inherit_many(J.JsNumber, [J.JsInt, J.jF])
    inherit_many(P.O, [H.fz, H.dO, P.bc, H.fx, H.hU, H.h3, H.i9, P.f2, P.fL, P.aS, P.hW, P.hS, P.bJ, P.fh, P.fj])
    inherit(P.dE, P.ev)
    inherit_many(P.dE, [H.cJ, W.az])
    inherit(H.ff, H.cJ)
    inherit_many(P.L, [H.A, H.c6, H.cf, P.dy, H.ip, Sgls.c])
    inherit_many(H.A, [H.M, H.dC])
    inherit(H.dr, H.c6)
    inherit_many(P.fv, [H.fB, H.hX])
    inherit_many(H.M, [H.y, H.a9, P.id])
    inherit(H.NullError, P.bc)
    inherit_many(H.c_,
        [H.j5, H.j6, H.kg, H.jH, H.lv, H.lx,
        P.kB, P.kA, P.lh, P.kK, P.kS, P.ke, P.kZ, P.Duration_toString_sixDigits, P.Duration_toString_twoDigits,
        W.jf, W.kF, W.jP, W.jO, W.l0, W.l1, W.l7,
        P.lE, P.lF,
        L.iS, L.iT, L.iU,
        V.j0, V.j1,
        X.iX, X.iY, X.iZ,
        HtmlRenderer.jx, HtmlRenderer.jy, HtmlRenderer.jw, HtmlRenderer.jz, HtmlRenderer.jB,
        HtmlRenderer.jC, HtmlRenderer.jD, HtmlRenderer.jV, HtmlRenderer.lp, HtmlRenderer.lq,
        Sgls.k5, Sgls.k6,
        T.k9, T.jk, T.jj, T.jl, T.ji, T.lD, T.BoostPassive, T.k3, T.kb, T.ko, T.kp,
        LangData.k_
        ]
    )
    inherit_many(H.kg, [H.kc, H.dg])
    inherit(P.dG, P.aU)
    inherit_many(P.dG, [H.aT, P.ic, W.i2])
    inherit_many(H.j6, [H.lw, P.li, P._wrapJsFunctionForAsync_closure, P.kL, P.jM, W.kd, W.le, P.l5, P.l6, P.ky, V.j_, HtmlRenderer.jA, Sgls.k7, LangData.lA, T.ka, T.jX, T.jY, T.k2, T.kq, T.kr, T.ks, T.kt, T.ku])
    inherit(H.hZ, P.dy)
    inherit(H.NativeTypedArray, H.ab)
    inherit_many(H.NativeTypedArray, [H._NativeTypedArrayOfDouble_NativeTypedArray_ListMixin, H._NativeTypedArrayOfInt_NativeTypedArray_ListMixin])
    inherit(H._NativeTypedArrayOfDouble_NativeTypedArray_ListMixin_FixedLengthListMixin, H._NativeTypedArrayOfDouble_NativeTypedArray_ListMixin)
    inherit(H.NativeTypedArrayOfDouble, H._NativeTypedArrayOfDouble_NativeTypedArray_ListMixin_FixedLengthListMixin)
    inherit(H._NativeTypedArrayOfInt_NativeTypedArray_ListMixin_FixedLengthListMixin, H._NativeTypedArrayOfInt_NativeTypedArray_ListMixin)
    inherit(H.NativeTypedArrayOfInt, H._NativeTypedArrayOfInt_NativeTypedArray_ListMixin_FixedLengthListMixin)
    inherit_many(H.NativeTypedArrayOfInt, [H.fE, H.fF, H.fG, H.fH, H.fI, H.dL, H.cx])
    inherit(H.eI, H.i9)
    inherit_many(H.j5, [P.kC, P.kD, P._TimerImpl_internalCallback, P.jp, P.kH, P.kO, P.kM, P.kJ, P.kN, P.kI, P.kR, P.kQ, P.kP, P.kf, P.l2, P.kW, P.lo, P.kY, P.km, P.kl, X.je, X.j9, HtmlRenderer.send_win_data, Sgls.k4])
    inherit(P.cg, P.i4)
    inherit(P.cK, P.im)
    inherit(P.eF, P.em)
    inherit(P.cM, P.eF)
    inherit(P.i5, P.i3)
    inherit(P.er, P.i7)
    inherit(P.eG, P.ii)
    inherit(P.kX, P.lf)
    inherit(P.eC, P.eM)
    inherit(P.eu, P.eC)
    inherit(P.fi, P.hP)
    inherit_many(P.fg, [P.jg, P.jI])
    inherit_many(P.fi, [P.jr, P.jJ, P.kn, P.kk])
    inherit(P.kj, P.jg)
    inherit_many(P.aS, [P.cD, P.fs])
    inherit_many(W.fn, [W.v, W.dH, W.eq])
    inherit_many(W.v, [W.Element, W.b6, W.cL])
    inherit_many(W.Element, [W.HtmlElement, P.p])
    inherit_many(W.HtmlElement, [W.AnchorElement, W.AreaElement, W.BaseElement, W.BodyElement, W.CanvasElement, W.c0, W.fp, W.dQ, W.h4, W.ek, W.ce, W.en, W.hQ, W.hR, W.cI])
    inherit(W.co, W.i6)
    inherit(W.dm, W.bb)
    inherit(W.cq, W.Blob)
    inherit_many(W.o, [W.c8, W.aY])
    inherit(W.bp, W.aY)
    inherit(W.ih, W.ig)
    inherit(W.dM, W.ih)
    inherit(W.hN, W.il)
    inherit(W.iz, W.iy)
    inherit(W.ex, W.iz)
    inherit(W.iB, W.iA)
    inherit(W.eH, W.iB)
    inherit(W.i8, W.i2)
    inherit(W.ia, P.hO)
    inherit(W.it, W.eD)
    inherit(P._StructuredCloneDart2Js, P._StructuredClone)
    inherit(P.kx, P.kw)
    inherit(P.cF, P.p)
    inherit(HtmlRenderer.fW, HtmlRenderer.ax)
    inherit_many(Sgls.n, [T.Skill, T.aZ, T.aB, T.bq, T.cB, T.bH, T.ah, T.aV, T.aF])
    inherit_many(T.Skill,
        [T.ActionSkill, T.h6, T.he, T.hn, T.hq, T.ea, T.ef,
        T.SklCounter, T.SklDefend, T.SklHide, T.SklMerge, T.SklProtect,
        T.SklReflect, T.SklReraise, T.SklShield, T.SklUpgrade, T.SklZombie
        ]
    )
    inherit_many(T.ActionSkill,
        [T.SklAbsorb, T.SklAccumulate, T.SklAssassinate, T.dd, T.SklBerserk,
        T.SklCharge, T.SklCharm, T.SklClone, T.SklCritical, T.SklCurse,
        T.SklDisperse, T.SklExchange, T.SklFire, T.sklHalf, T.SklHaste,
        T.SklHeal, T.SklIce, T.SklIron, T.SklPoison, T.SklQuake,
        T.SklRapid, T.SklRevive, T.hu, T.SklShadow, T.SklSlow,
        T.hj, T.SklSummon, T.SklThunder,
        T.e2, T.hb, T.dl, T.hd, T.hm,
        T.dB, T.hp, T.hr, T.hA, T.h8,
        T.hD, T.SkillVoid, T.hg, T.ee, T.hz
        ]
    )
    inherit_many(T.aZ, [T.dj, T.dw, T.dx, T.eh, T.bd, T.h1])
    inherit_many(T.x, [T.dI, T.c3, T.hF, T.fC, T.hY])
    inherit_many(T.Plr, [T.dR, T.aM, T.cz, T.fP, T.PlrBossTest, T.PlrBossTest2, T.fQ, T.cy])
    inherit_many(T.aB, [T.dn, T.dT, T.ik])
    inherit_many(T.bq, [T.dS, T.b8])
    inherit_many(T.aM, [T.PlrShadow, T.PlrSummon, T.fX])
    inherit_many(T.cz, [T.f5, T.f6, T.PlrBossCovid, T.f8, T.de, T.df, T.f9, T.fa, T.PlrBossSlime, T.fc, T.fd])
    inherit(T.fR, T.cy)
    inherit(T.fb, T.PlrBossSlime)
    inherit(T.eg, T.SklCharm)
    inherit_many(T.IPlr, [T.NPlr, T.HPlr, T.MPlr, T.DPlr])
    inherit_many(T.aX, [T.h2, T.dX])
    inherit(T.fY, T.cB)
    inherit(T.cA, T.ah)
    inherit_many(T.aV, [T.ca, T.h0])
    inherit(T.cp, T.aF)
    inherit(T.ij, T.bH)
    inherit(T.dV, T.ij)
    inherit(T.e0, T.ik)
    inherit_many(T.Weapon, [T.j2, T.eo, T.jq, T.jN, T.k1, T.ep, T.kv])
    inherit(T.hy, T.ea)
    inherit(T.hc, T.SklCounter)
    inherit(LangData.SuperRC4, Y.RC4)

    mixin(H.cJ, H.hV)
    mixin(H._NativeTypedArrayOfDouble_NativeTypedArray_ListMixin, P.z)
    mixin(H._NativeTypedArrayOfDouble_NativeTypedArray_ListMixin_FixedLengthListMixin, H.du)
    mixin(H._NativeTypedArrayOfInt_NativeTypedArray_ListMixin, P.z)
    mixin(H._NativeTypedArrayOfInt_NativeTypedArray_ListMixin_FixedLengthListMixin, H.du)
    mixin(P.cK, P.i1)
    mixin(P.ev, P.z)
    mixin(P.eM, P.dY)
    mixin(W.i6, W.j8)
    mixin(W.ig, P.z)
    mixin(W.ih, W.cr)
    mixin(W.il, P.aU)
    mixin(W.iy, P.z)
    mixin(W.iz, W.cr)
    mixin(W.iA, P.z)
    mixin(W.iB, W.cr)
    mixin(T.ij, T.x)
    mixin(T.ik, T.x)
})()
var init = {
    typeUniverse: {
        eC: new Map(),
        tR: {},
        eT: {},
        tPV: {},
        sEA: []
    },
    mangledGlobalNames: {
        l: "int",
        bu: "double",
        vc: "num",
        m: "String",
        ac: "bool",
        N: "Null",
        w: "List"
    },
    mangledNames: {},
    types: ["~()", "~(u*,u*,l*,b9*,aq*)", "l*(l*)", "@(u*)", "~(~())", "~(@)", "N(o*)", "bL*(m*,u*)", "~(o*)", "~(H,ba)", "m(m)", "@()", "m(l)", "ac(aN)", "ac(m)", "l*(l*,l*)", "N(m*,x*)", "m*(c7*)", "N()", "m*()", "ac(Q,m,m,cP)", "w<l*>*()", "N(@)", "N(@,@)", "~(@,@)", "@(@,@)", "~(v,v?)", "N(~())", "@(@)", "N(m*,l*)", "ac*(u*)", "~(c8*)", "N(H,ba)", "~(m*)", "~([ac*])", "w<w<m*>*>*(m*)", "w<m*>*(m*)", "N(m*,ax*)", "~(ax*)", "~(o)", "bl<N>*()", "~(m,m)", "m*(H*)", "l*(bG*,bG*)", "w<w<bu*>*>*()", "ac*(l*)", "ac*(q*)", "ac(v)", "@(@,m)", "m*(b7*)", "~(l*)", "~(H?,H?)", "U<@>(@)", "~(q*,l*,l*)", "~(b9*,aq*)", "m*(m*)", "ep*(m*,u*)", "eo*(m*,u*)", "@(m)", "l(@,@)", "N(@,ba)", "~(l,@)", "l*(ax*,ax*)", "l*(b7*,b7*)", "l*(u*,u*)", "N(m*,m*)"],
    interceptorsByTag: null,
    leafTags: null,
    arrayRti: Symbol("$ti")
}
H._Universe_addRules(init.typeUniverse, JSON.parse('{"fO":"bE","bs":"bE","bn":"bE","vt":"o","zC":"o","vs":"p","zG":"p","vu":"r","zK":"r","zI":"v","xZ":"v","zP":"bp","vw":"aY","vv":"b6","A_":"b6","zM":"c9","zL":"ab","fw":{"ac":[]},"cs":{"N":[]},"bE":{"nM":[]},"E":{"w":["1"],"A":["1"]},"jG":{"E":["1"],"w":["1"],"A":["1"]},"dz":{"l":[]},"bD":{"m":[],"fN":[]},"fz":{"O":[]},"ff":{"z":["l"],"w":["l"],"A":["l"],"z.E":"l"},"dO":{"bc":[],"O":[]},"A":{"L":["1"]},"M":{"A":["1"],"L":["1"]},"c6":{"L":["2"],"L.E":"2"},"dr":{"c6":["1","2"],"A":["2"],"L":["2"],"L.E":"2"},"y":{"M":["2"],"A":["2"],"L":["2"],"L.E":"2","M.E":"2"},"cf":{"L":["1"],"L.E":"1"},"cJ":{"z":["1"],"w":["1"],"A":["1"]},"a9":{"M":["1"],"A":["1"],"L":["1"],"L.E":"1","M.E":"1"},"dP":{"bc":[],"O":[]},"fx":{"O":[]},"hU":{"O":[]},"eE":{"ba":[]},"h3":{"O":[]},"aT":{"aU":["1","2"],"bo":["1","2"]},"dC":{"A":["1"],"L":["1"],"L.E":"1"},"ct":{"o0":[],"fN":[]},"ew":{"c7":[]},"hZ":{"L":["o1"],"L.E":"o1"},"bK":{"c7":[]},"ip":{"L":["c7"],"L.E":"c7"},"cw":{"ag":["1"],"ab":[]},"c9":{"z":["bu"],"ag":["bu"],"w":["bu"],"ab":[],"A":["bu"],"z.E":"bu"},"dK":{"z":["l"],"ag":["l"],"w":["l"],"ab":[],"A":["l"]},"fE":{"z":["l"],"ag":["l"],"w":["l"],"ab":[],"A":["l"],"z.E":"l"},"fF":{"z":["l"],"ag":["l"],"w":["l"],"ab":[],"A":["l"],"z.E":"l"},"fG":{"z":["l"],"ag":["l"],"w":["l"],"ab":[],"A":["l"],"z.E":"l"},"fH":{"z":["l"],"ag":["l"],"w":["l"],"ab":[],"A":["l"],"z.E":"l"},"fI":{"z":["l"],"ag":["l"],"w":["l"],"ab":[],"A":["l"],"z.E":"l"},"dL":{"z":["l"],"ag":["l"],"w":["l"],"ab":[],"A":["l"],"z.E":"l"},"cx":{"z":["l"],"ag":["l"],"w":["l"],"ab":[],"A":["l"],"z.E":"l"},"i9":{"O":[]},"eI":{"bc":[],"O":[]},"U":{"bl":["1"]},"f3":{"O":[]},"cg":{"i4":["1"]},"cK":{"im":["1"]},"cM":{"em":["1"]},"eF":{"em":["1"]},"eu":{"dY":["1"],"A":["1"]},"dy":{"L":["1"]},"dE":{"z":["1"],"w":["1"],"A":["1"]},"dG":{"aU":["1","2"],"bo":["1","2"]},"aU":{"bo":["1","2"]},"eC":{"dY":["1"],"A":["1"]},"ic":{"aU":["m","@"],"bo":["m","@"]},"id":{"M":["m"],"A":["m"],"L":["m"],"L.E":"m","M.E":"m"},"w":{"A":["1"]},"o1":{"c7":[]},"m":{"fN":[]},"f2":{"O":[]},"bc":{"O":[]},"fL":{"O":[]},"aS":{"O":[]},"cD":{"O":[]},"fs":{"O":[]},"hW":{"O":[]},"hS":{"O":[]},"bJ":{"O":[]},"fh":{"O":[]},"fM":{"O":[]},"el":{"O":[]},"fj":{"O":[]},"iq":{"ba":[]},"Q":{"v":[]},"c8":{"o":[]},"bp":{"o":[]},"cP":{"aN":[]},"r":{"Q":[],"v":[]},"f0":{"Q":[],"v":[]},"f1":{"Q":[],"v":[]},"cn":{"Q":[],"v":[]},"bY":{"Q":[],"v":[]},"di":{"Q":[],"v":[]},"b6":{"v":[]},"c0":{"Q":[],"v":[]},"cq":{"bX":[]},"fp":{"Q":[],"v":[]},"az":{"z":["v"],"w":["v"],"A":["v"],"z.E":"v"},"dM":{"z":["v"],"w":["v"],"ag":["v"],"A":["v"],"z.E":"v"},"dQ":{"Q":[],"v":[]},"h4":{"Q":[],"v":[]},"ek":{"Q":[],"v":[]},"hN":{"aU":["m","m"],"bo":["m","m"]},"ce":{"Q":[],"v":[]},"en":{"Q":[],"v":[]},"hQ":{"Q":[],"v":[]},"hR":{"Q":[],"v":[]},"cI":{"Q":[],"v":[]},"aY":{"o":[]},"cL":{"v":[]},"ex":{"z":["v"],"w":["v"],"ag":["v"],"A":["v"],"z.E":"v"},"eH":{"z":["bb"],"w":["bb"],"ag":["bb"],"A":["bb"],"z.E":"bb"},"i2":{"aU":["m","m"],"bo":["m","m"]},"i8":{"aU":["m","m"],"bo":["m","m"]},"dN":{"aN":[]},"eD":{"aN":[]},"it":{"aN":[]},"is":{"aN":[]},"eJ":{"c4":[]},"cF":{"p":[],"Q":[],"v":[]},"p":{"Q":[],"v":[]},"fK":{"aN":[]},"fW":{"ax":[]},"c":{"L":["1*"],"L.E":"1*"},"cy":{"u":[]},"aZ":{"n":["@"]},"cB":{"n":["@"]},"bH":{"n":["@"]},"aB":{"n":["@"]},"ah":{"n":["@"]},"aV":{"n":["@"]},"bq":{"n":["@"]},"aF":{"n":["@"]},"fy":{"n":["@"]},"q":{"n":["@"]},"b5":{"q":[],"n":["@"]},"eb":{"q":[],"bq":[],"n":["@"]},"e1":{"q":[],"n":["@"]},"h5":{"q":[],"n":["@"],"x":[]},"h7":{"q":[],"n":["@"]},"dd":{"q":[],"aV":[],"n":["@"],"x":[]},"h9":{"q":[],"n":["@"]},"ha":{"q":[],"n":["@"],"x":[]},"dj":{"aZ":[],"n":["@"],"x":[]},"e3":{"q":[],"n":["@"]},"dI":{"x":[]},"dR":{"bC":[],"u":[]},"e4":{"q":[],"n":["@"]},"e5":{"q":[],"n":["@"]},"dn":{"aB":[],"n":["@"],"x":[]},"hf":{"q":[],"n":["@"]},"hh":{"q":[],"n":["@"]},"hi":{"q":[],"n":["@"]},"c3":{"x":[]},"cc":{"q":[],"n":["@"]},"e7":{"q":[],"n":["@"]},"dw":{"aZ":[],"n":["@"],"x":[]},"hk":{"q":[],"n":["@"]},"e8":{"q":[],"n":["@"]},"dx":{"aZ":[],"n":["@"],"x":[]},"e9":{"q":[],"n":["@"]},"ho":{"q":[],"n":["@"],"x":[]},"dS":{"bq":[],"n":["@"],"x":[]},"ht":{"q":[],"n":["@"]},"hv":{"q":[],"n":["@"]},"ec":{"q":[],"n":["@"]},"hx":{"q":[],"n":["@"]},"hu":{"q":[],"n":["@"]},"fS":{"bC":[],"u":[]},"hB":{"q":[],"n":["@"]},"eh":{"aZ":[],"n":["@"],"x":[]},"hG":{"q":[],"n":["@"]},"hj":{"q":[],"n":["@"]},"fT":{"bC":[],"u":[]},"hH":{"q":[],"n":["@"]},"hI":{"q":[],"n":["@"]},"f5":{"u":[]},"h6":{"q":[],"aB":[],"n":["@"]},"e2":{"q":[],"n":["@"]},"fP":{"u":[]},"fU":{"u":[]},"fV":{"u":[]},"fQ":{"u":[]},"cz":{"u":[]},"f6":{"u":[]},"hb":{"q":[],"n":["@"]},"f7":{"u":[]},"dk":{"x":[]},"dl":{"q":[],"n":["@"]},"he":{"q":[],"ah":[],"n":["@"]},"hd":{"q":[],"n":["@"]},"f8":{"u":[]},"hn":{"q":[],"aB":[],"n":["@"]},"hm":{"q":[],"n":["@"]},"de":{"u":[]},"dB":{"q":[],"n":["@"],"x":[]},"hq":{"q":[],"ah":[],"n":["@"]},"hp":{"q":[],"n":["@"]},"df":{"u":[]},"hr":{"q":[],"n":["@"],"x":[]},"ea":{"q":[],"aF":[],"n":["@"]},"f9":{"u":[]},"fa":{"u":[]},"hA":{"q":[],"n":["@"]},"fR":{"u":[]},"bZ":{"u":[]},"fb":{"bZ":[],"bC":[],"u":[]},"hF":{"x":[]},"ef":{"q":[],"aF":[],"n":["@"]},"fc":{"u":[]},"fd":{"u":[]},"eg":{"q":[],"n":["@"]},"aM":{"bC":[],"u":[]},"bd":{"aZ":[],"n":["@"]},"fY":{"cB":[],"n":["@"]},"dT":{"aB":[],"n":["@"]},"cA":{"ah":[],"n":["@"]},"ca":{"aV":[],"n":["@"]},"b8":{"bq":[],"n":["@"]},"cp":{"aF":[],"n":["@"]},"h8":{"q":[],"n":["@"]},"hD":{"q":[],"n":["@"]},"cb":{"q":[],"ah":[],"n":["@"]},"e6":{"q":[],"aB":[],"n":["@"]},"hl":{"q":[],"ah":[],"n":["@"]},"fC":{"x":[]},"hs":{"q":[],"fy":[],"n":["@"]},"dV":{"bH":[],"n":["@"],"x":[]},"ed":{"q":[],"bH":[],"n":["@"]},"hw":{"q":[],"aF":[],"n":["@"]},"e0":{"aB":[],"n":["@"],"x":[]},"hC":{"q":[],"aV":[],"n":["@"]},"hJ":{"q":[],"ah":[],"n":["@"],"x":[]},"bI":{"q":[],"n":["@"]},"fX":{"bC":[],"u":[]},"hY":{"x":[]},"hK":{"q":[],"fy":[],"n":["@"]},"hg":{"q":[],"n":["@"]},"fl":{"x":[]},"h0":{"aV":[],"n":["@"]},"h1":{"aZ":[],"n":["@"]},"ee":{"q":[],"n":["@"]},"hy":{"q":[],"aF":[],"n":["@"]},"hz":{"q":[],"n":["@"]},"hc":{"q":[],"ah":[],"n":["@"]}}'))
H._Universe_addErasedTypes(init.typeUniverse, JSON.parse('{"db":1,"A":1,"cv":1,"fB":2,"hX":1,"du":1,"hV":1,"cJ":1,"fA":1,"cw":1,"hO":1,"hP":2,"i1":1,"i5":1,"i3":1,"eF":1,"i7":1,"er":1,"ii":1,"eG":1,"io":1,"ie":1,"dy":1,"dE":1,"dG":2,"eC":1,"ev":1,"eM":1,"fg":2,"fi":2,"fv":1,"ia":1,"cr":1,"dv":1,"n":1}'))
var u = {
    b: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&'()*+,-./:;<=>?@[]^_`{|}~ ",
    c: "Error handler must accept one Object or one Object and a StackTrace as arguments, and return a value of the returned future's type"
}
var t = (function rtii() {
    var find_type = H.findType
    return {
        fh: find_type("@<l*>"),
        cR: find_type("cn"),
        fK: find_type("bX"),
        b: find_type("bY"),
        gw: find_type("A<@>"),
        R: find_type("Q"),
        u: find_type("O"),
        aD: find_type("o"),
        c8: find_type("cq"),
        Z: find_type("rS"),
        h: find_type("bl<@>"),
        I: find_type("c4"),
        x: find_type("E<aN>"),
        s: find_type("E<m>"),
        gn: find_type("E<@>"),
        dC: find_type("E<l>"),
        H: find_type("E<b5*>"),
        Y: find_type("E<rS*>"),
        eV: find_type("E<b7*>"),
        j: find_type("E<fr*>"),
        D: find_type("E<w<@>*>"),
        E: find_type("E<w<w<m*>*>*>"),
        t: find_type("E<w<m*>*>"),
        gt: find_type("E<w<bu*>*>"),
        f: find_type("E<w<l*>*>"),
        gr: find_type("E<cy*>"),
        L: find_type("E<u*>"),
        F: find_type("E<bG*>"),
        ak: find_type("E<ax*>"),
        U: find_type("E<aX*>"),
        M: find_type("E<aq*>"),
        q: find_type("E<q*>"),
        gN: find_type("E<eb*>"),
        V: find_type("E<m*>"),
        he: find_type("E<bu*>"),
        i: find_type("E<l*>"),
        T: find_type("cs"),
        eH: find_type("nM"),
        O: find_type("bn"),
        aU: find_type("ag<@>"),
        d5: find_type("aT<m*,u*>"),
        aH: find_type("w<@>"),
        l: find_type("c<aF*>"),
        m: find_type("c<fy*>"),
        G: find_type("c<bq*>"),
        k: find_type("c<ah*>"),
        e: find_type("c<aB*>"),
        g: find_type("c<aV*>"),
        _: find_type("c<bH*>"),
        p: find_type("c<cB*>"),
        n: find_type("c<aZ*>"),
        eO: find_type("bo<@,@>"),
        bQ: find_type("y<m,w<w<m*>*>*>"),
        dG: find_type("y<m,w<m*>*>"),
        fj: find_type("y<m*,m>"),
        bK: find_type("dH"),
        bZ: find_type("dJ"),
        dD: find_type("ab"),
        bm: find_type("cx"),
        P: find_type("N"),
        K: find_type("H"),
        eh: find_type("fN"),
        fv: find_type("o0"),
        bJ: find_type("a9<m>"),
        ew: find_type("cF"),
        N: find_type("m"),
        g7: find_type("p"),
        aW: find_type("cI"),
        eK: find_type("bc"),
        bI: find_type("bs"),
        h9: find_type("cL"),
        ac: find_type("az"),
        eI: find_type("U<@>"),
        fJ: find_type("U<l>"),
        y: find_type("ac"),
        gR: find_type("bu"),
        z: find_type("@"),
        J: find_type("@(H)"),
        C: find_type("@(H,ba)"),
        ci: find_type("l"),
        aJ: find_type("dd*"),
        ch: find_type("df*"),
        b8: find_type("bZ*"),
        o: find_type("dj*"),
        cu: find_type("dk*"),
        w: find_type("dm*"),
        dK: find_type("dn*"),
        A: find_type("c0*"),
        eF: find_type("fo*"),
        a: find_type("c3*"),
        e_: find_type("dw*"),
        fM: find_type("bC*"),
        W: find_type("x*"),
        ck: find_type("dx*"),
        r: find_type("dB*"),
        eG: find_type("w<m*>*"),
        gl: find_type("n<@>*"),
        cF: find_type("bo<@,@>*"),
        f5: find_type("dI*"),
        aw: find_type("0&*"),
        c: find_type("H*"),
        cr: find_type("u*"),
        ax: find_type("dS*"),
        Q: find_type("dV*"),
        v: find_type("dX*"),
        d: find_type("aq*"),
        eb: find_type("e0*"),
        c5: find_type("q*"),
        S: find_type("eh*"),
        X: find_type("m*"),
        B: find_type("l*"),
        bG: find_type("bl<N>?"),
        cK: find_type("H?"),
        di: find_type("vc"),
        aX: find_type("~(H)"),
        da: find_type("~(H,ba)")
    }
})();
(function constants() {
    var make_const_list = hunkHelpers.makeConstList
    C.BodyElement = W.BodyElement.prototype
    C.H = W.CanvasElement.prototype
    C.k = W.CanvasRenderingContext2D.prototype
    C.i = W.co.prototype
    C.h = W.c0.prototype
    C.J = J.Interceptor.prototype
    C.Array = J.JsArray.prototype
    C.JsInt = J.JsInt.prototype
    C.d = J.JsNumber.prototype
    C.String = J.JsString.prototype
    C.JavaScriptFunction = J.JavaScriptFunction.prototype
    C.Q = W.dQ.prototype
    C.PlainJavaScriptObject = J.PlainJavaScriptObject.prototype
    C.R = W.ek.prototype
    C.j = W.ce.prototype
    C.u = W.en.prototype
    C.UnknownJavaScriptObject = J.UnknownJavaScriptObject.prototype
    C.U = W.eq.prototype
    C.v = W.eH.prototype
    C.V = new P.js()
    C.o = new P.jr()

    C.w = function () {
        var toStringFunction = Object.prototype.toString;

        function getTag(o) {
            var s = toStringFunction.call(o);
            return s.substring(8, s.length - 1);
        }

        function getUnknownTag(object, tag) {
            if (/^HTML[A-Z].*Element$/.test(tag)) {
                var name = toStringFunction.call(object);
                if (name == "[object Object]") return null;
                return "HTMLElement";
            }
        }

        function prototypeForTag(tag) {
            if (typeof window == "undefined") return null;
            if (typeof window[tag] == "undefined") return null;
            var constructor = window[tag];
            if (typeof constructor != "function") return null;
            return constructor.prototype;
        }

        function discriminator(tag) {
            return null;
        }
        var isBrowser = typeof navigator == "object";
        return {
            getTag: getTag,
            getUnknownTag: getUnknownTag,
            prototypeForTag: prototypeForTag,
            discriminator: discriminator
        };
    }

    C.C = new P.jI()
    C.D = new P.fM()
    C.e = new P.kj()
    C.E = new P.kn()
    C.F = new P.kT()
    C.f = new P.kX()
    C.G = new P.iq()
    C.I = new P.Duration(0)
    C.L = new P.jJ(null)
    C.M = H.b(make_const_list(["*::class", "*::dir", "*::draggable", "*::hidden", "*::id", "*::inert", "*::itemprop", "*::itemref", "*::itemscope", "*::lang", "*::spellcheck", "*::title", "*::translate",
        "A::accesskey", "A::coords", "A::hreflang", "A::name", "A::shape", "A::tabindex", "A::target", "A::type", "AREA::accesskey", "AREA::alt", "AREA::coords", "AREA::nohref", "AREA::shape", "AREA::tabindex", "AREA::target", "AUDIO::controls", "AUDIO::loop", "AUDIO::mediagroup", "AUDIO::muted", "AUDIO::preload", "BDO::dir",
        "BODY::alink", "BODY::bgcolor", "BODY::link", "BODY::text", "BODY::vlink", "BR::clear", "BUTTON::accesskey", "BUTTON::disabled", "BUTTON::name", "BUTTON::tabindex", "BUTTON::type", "BUTTON::value", "CANVAS::height", "CANVAS::width", "CAPTION::align", "COL::align", "COL::char", "COL::charoff", "COL::span", "COL::valign", "COL::width", "COLGROUP::align", "COLGROUP::char", "COLGROUP::charoff", "COLGROUP::span", "COLGROUP::valign", "COLGROUP::width", "COMMAND::checked", "COMMAND::command", "COMMAND::disabled", "COMMAND::label", "COMMAND::radiogroup", "COMMAND::type", "DATA::value", "DEL::datetime", "DETAILS::open", "DIR::compact",
        "DIV::align", "DL::compact", "FIELDSET::disabled", "FONT::color", "FONT::face", "FONT::size", "FORM::accept", "FORM::autocomplete", "FORM::enctype", "FORM::method", "FORM::name", "FORM::novalidate", "FORM::target", "FRAME::name", "H1::align", "H2::align", "H3::align", "H4::align", "H5::align", "H6::align", "HR::align", "HR::noshade", "HR::size", "HR::width", "HTML::version", "IFRAME::align", "IFRAME::frameborder", "IFRAME::height", "IFRAME::marginheight", "IFRAME::marginwidth", "IFRAME::width", "IMG::align", "IMG::alt", "IMG::border", "IMG::height", "IMG::hspace", "IMG::ismap", "IMG::name", "IMG::usemap", "IMG::vspace", "IMG::width",
        "INPUT::accept", "INPUT::accesskey", "INPUT::align", "INPUT::alt", "INPUT::autocomplete", "INPUT::autofocus", "INPUT::checked", "INPUT::disabled", "INPUT::inputmode", "INPUT::ismap", "INPUT::list", "INPUT::max", "INPUT::maxlength", "INPUT::min", "INPUT::multiple", "INPUT::name", "INPUT::placeholder", "INPUT::readonly", "INPUT::required", "INPUT::size", "INPUT::step", "INPUT::tabindex", "INPUT::type", "INPUT::usemap", "INPUT::value",
        "INS::datetime", "KEYGEN::disabled", "KEYGEN::keytype", "KEYGEN::name", "LABEL::accesskey", "LABEL::for", "LEGEND::accesskey", "LEGEND::align", "LI::type", "LI::value", "LINK::sizes", "MAP::name", "MENU::compact", "MENU::label", "MENU::type", "METER::high", "METER::low", "METER::max", "METER::min", "METER::value", "OBJECT::typemustmatch", "OL::compact", "OL::reversed", "OL::start", "OL::type", "OPTGROUP::disabled", "OPTGROUP::label", "OPTION::disabled", "OPTION::label", "OPTION::selected", "OPTION::value", "OUTPUT::for", "OUTPUT::name", "P::align", "PRE::width", "PROGRESS::max", "PROGRESS::min", "PROGRESS::value",
        "SELECT::autocomplete", "SELECT::disabled", "SELECT::multiple", "SELECT::name", "SELECT::required", "SELECT::size", "SELECT::tabindex", "SOURCE::type", "TABLE::align", "TABLE::bgcolor", "TABLE::border", "TABLE::cellpadding", "TABLE::cellspacing", "TABLE::frame", "TABLE::rules", "TABLE::summary", "TABLE::width", "TBODY::align", "TBODY::char", "TBODY::charoff", "TBODY::valign",
        "TD::abbr", "TD::align", "TD::axis", "TD::bgcolor", "TD::char", "TD::charoff", "TD::colspan", "TD::headers", "TD::height", "TD::nowrap", "TD::rowspan", "TD::scope", "TD::valign", "TD::width",
        "TEXTAREA::accesskey", "TEXTAREA::autocomplete", "TEXTAREA::cols", "TEXTAREA::disabled", "TEXTAREA::inputmode", "TEXTAREA::name", "TEXTAREA::placeholder", "TEXTAREA::readonly", "TEXTAREA::required", "TEXTAREA::rows", "TEXTAREA::tabindex", "TEXTAREA::wrap", "TFOOT::align", "TFOOT::char", "TFOOT::charoff", "TFOOT::valign",
        "TH::abbr", "TH::align", "TH::axis", "TH::bgcolor", "TH::char", "TH::charoff", "TH::colspan", "TH::headers", "TH::height", "TH::nowrap", "TH::rowspan", "TH::scope", "TH::valign", "TH::width", "THEAD::align", "THEAD::char", "THEAD::charoff", "THEAD::valign", "TR::align", "TR::bgcolor", "TR::char", "TR::charoff", "TR::valign", "TRACK::default", "TRACK::kind", "TRACK::label", "TRACK::srclang", "UL::compact", "UL::type", "VIDEO::controls", "VIDEO::height", "VIDEO::loop", "VIDEO::mediagroup", "VIDEO::muted", "VIDEO::preload", "VIDEO::width"]), t.V)
    C.N = H.b(make_const_list(["", "", "", "", "", "", "", "", "", ""]), t.V)
    C.O = H.b(make_const_list(["HEAD", "AREA", "BASE", "BASEFONT", "BR", "COL", "COLGROUP", "EMBED", "FRAME", "FRAMESET", "HR", "IMAGE", "IMG", "INPUT", "ISINDEX", "LINK", "META", "PARAM", "SOURCE", "STYLE", "TITLE", "WBR"]), t.V)
    C.P = H.b(make_const_list([]), t.V)
    C.r = H.b(make_const_list(["bind", "if", "ref", "repeat", "syntax"]), t.V)
    C.l = H.b(make_const_list(["A::href", "AREA::href", "BLOCKQUOTE::cite", "BODY::background", "COMMAND::icon", "DEL::cite", "FORM::action", "IMG::src", "INPUT::src", "INS::cite", "Q::cite", "VIDEO::poster"]), t.V)
    C.S = H.vp("N")
    C.T_kk = new P.kk(false)
})();
(function staticFields() {
    $.kU = null
    $.bk = 0
    $.dh = null
    $.nE = null
    $.oB = null
    $.ov = null
    $.oL = null
    $.lt = null
    $.ly = null
    $.mA = null
    $.cR = null
    $.eN = null
    $.eO = null
    $.ms = false
    $.P = C.f
    $.ch = H.b([], H.findType("E<H>"))
    $.bA = null
    $.m4 = null
    $.nJ = null
    $.nI = null
    $.et = P.cu(t.N, t.Z)
    $.jU = 0
    $.ay = P.cu(t.X, H.findType("ax*"))
    $.rW = function () {
        var s = t.X
        return P.dD(["aokiji", "R0lGODlhEAAQAMIDAAAAAEB2/4Kl/////////////////////yH5BAEKAAQALAAAAAAQABAAAANISLrQsJC1MVwkLgSqLW6bQFFi4ACjIGxDoI7gqHFsO9UsXgFuPXIr0Or3691kHGSMxuRMSMPWi3IK/UqeTM7UuDio3YskDEkAADs=", "conan", "R0lGODlhEAAQAMIAAAAAANAYISpXyf///wAAAAAAAAAAAAAAACH5BAEKAAQALAAAAAAQABAAAANISATczkqBQasFcQlrBV6MsHGiEzQj5TEnELzM5cIsbdLLC+/6N/O/E6j3IP5ilVqrBUgNVi6HyDltSJoiVekTCU23me4DEkkAADs=", "covid", "R0lGODlhEAAQAIIAMf/GAOpK/f///wAAAP///wAAAAAAAAAAACH5BAEAAAQALAAAAAAQABAAAgNKSLrTvZC4AeqIqgEttoNU1wSOx1BBmoabNJGDGpjURlqBAJf6ba+WWgwmy3kcRYFO6AKolMuJBCAqmjIUJKd12moemNrxgnF9IgkAOw==", "ikaruga", "R0lGODlhEAAQAMIEAAAAAAcHB7MABFuV/////////////////yH5BAEKAAcALAAAAAAQABAAAANKeLrRsZA1Qlw8jmoCGgzaMAiC9iiTOFBk6WGUypLUk4pbW00EvhG0XWz1C2Z8o9kO1uuNSqUKCqR60l5MZ1AqAf0skczudJliFwkAOw==", "lazy", "R0lGODlhEAAQAMICAAAAAAgICP+3t/////+3t/+3t/+3t/+3tyH5BAEKAAQALAAAAAAQABAAAANPSLpM8K9JMCqQDoIwwp3VQG1fBnFeWFKW6GnL1rFi87raSQQcvXEhHkeQGwqOncBxKeAxj07io6kkQZXPKJM3YCa7yySwIhwnd5qAokhIAAA7", "mario", "R0lGODlhEAAQAIEAMQAAANgoAPz8/AAAACH5BAEAAAAALAAAAAAQABAAAQJBhD2px6AhRFgshRvvHCdJGH1CgoDhKXEWqLHboH2tvEItpq3ZvXvnfPIphooI0YgcLXyjpLKDQnE6g6hxSiVSAAUAOw==", "mosquito", "R0lGODlhEAAQAKECAAAAAP8AAP///////yH5BAEKAAMALAAAAAAQABAAAAJB3ICpaCnxRIRKoAkpsJu/AHpch4DgxR0kcK6GKrGB+zrylrzH2OL62or9SKcYYIgr5mq82eXI5AQtw1gxhVwwDAUAOw==", "saitama", "R0lGODlhEAAQAMIGAAAAAAgICGxsbP/AmP/PV/////jIUfjIUSH5BAEKAAcALAAAAAAQABAAAANKeLrRsZC1MVw8juraYNhUIVYSGIodZprPtG7ZC8YyFxSC8OZFAIi4nJAnAhgLx2DxZwQQCMZn7hmFOp/YKZZa3Xqth6bR1xADDgkAOw==", "seed", "R0lGODlhEAAQAMIDAAAAAG9tbUCy5////////////////////yH5BAEKAAQALAAAAAAQABAAAANFSLrQsJC1MVwkjuraVN6gA4CDIJCNSW5BkJon2LZpAMdzMLiAYN85HQ/28wWHpmJrN3sRjUya4xm0YJzNTmTKe1wkWkgCADs=", "slime", "R0lGODlhEAAQAMIEAAABAFaSRV6qSLn9qgAAAAAAAAAAAAAAACH5BAEKAAQALAAAAAAQABAAAANCSKrQvpA4QcWDrWoLsB5bxwDVYApB2jClaaaqRMIuCk92CuYBR8G9DSUjLBI3wMpRQzvhis4OqVUbjopKkczBvSQAADs=", "sonic", "R0lGODlhEAAQAMIDAAgICOgSJh9O/////////////////////yH5BAEKAAQALAAAAAAQABAAAANBSLrQsJA1IVwkjuraINDDsFUSFYZbh5knqj2T0LpUBp4jN9JpnJuc1S8UIGE+uUBRJRQonzXP5LlkSpCWy/URSQAAOw==", "yuri", "R0lGODlhEAAQAKEDAAAAAN4H28asxv///yH5BAEKAAMALAAAAAAQABAAAAI+hI85EB3s4DNBiFcvs3NjvmlL9WkesEDnKI7fw8Lpi6roMJ42jh8NNeEJVb+bsFc0HIfB5ZFhdPIO0mf0WAAAOw=="], s, s)
    }()
    $.mg = function () {
        var s = t.X
        return P.cu(s, s)
    }()
    $.k8 = function () {
        var s = t.X
        return P.cu(s, s)
    }()
    $.e_ = 0
    $.mf = function () {
        var s = t.i
        return H.b([H.b([255, 255, 255], s), H.b([255, 255, 255], s), H.b([0, 0, 0], s), H.b([0, 180, 0], s), H.b([0, 255, 0], s), H.b([255, 0, 0], s), H.b([255, 192, 0], s), H.b([255, 255, 0], s), H.b([0, 224, 128], s), H.b([255, 0, 128], s), H.b([255, 108, 0], s), H.b([0, 108, 255], s), H.b([0, 192, 255], s), H.b([0, 255, 255], s), H.b([128, 120, 255], s), H.b([128, 224, 255], s), H.b([255, 0, 255], s), H.b([40, 40, 255], s), H.b([128, 0, 255], s), H.b([0, 144, 0], s), H.b([144, 0, 0], s)], t.f)
    }()
    $.md = null
    $.dZ = H.b([], t.f)
    $.me = H.b([], t.f)
    $.o5 = H.b([], t.f)
    $.od = function () {
        var s = t.X
        return P.cu(s, s)
    }()
    $.ox = ""
    $.lj = null
    $.mb = 0
    $.nV = 0
    $.nW = 0
})();
(function lazyInitializers() {
    var lazy_final = hunkHelpers.lazyFinal,
        lazy_old = hunkHelpers.lazyOld
    lazy_final($, "vy", "oR", function () {
        return H.getIsolateAffinityTag("_$dart_dartClosure")
    })
    lazy_final($, "A0", "r7", function () {
        return H.br(H.ki({
            toString: function () {
                return "$receiver$"
            }
        }))
    })
    lazy_final($, "A1", "r8", function () {
        return H.br(H.ki({
            $method$: null,
            toString: function () {
                return "$receiver$"
            }
        }))
    })
    lazy_final($, "A2", "r9", function () {
        return H.br(H.ki(null))
    })
    lazy_final($, "A3", "ra", function () {
        return H.br(function () {
            var $argumentsExpr$ = "$arguments$"
            try {
                null.$method$($argumentsExpr$)
            } catch (q) {
                return q.message
            }
        }())
    })
    lazy_final($, "A6", "rd", function () {
        return H.br(H.ki(void 0))
    })
    lazy_final($, "A7", "re", function () {
        return H.br(function () {
            var $argumentsExpr$ = "$arguments$"
            try {
                (void 0).$method$($argumentsExpr$)
            } catch (q) {
                return q.message
            }
        }())
    })
    lazy_final($, "A5", "rc", function () {
        return H.br(H.o8(null))
    })
    lazy_final($, "A4", "rb", function () {
        return H.br(function () {
            try {
                null.$method$
            } catch (q) {
                return q.message
            }
        }())
    })
    lazy_final($, "A9", "rg", function () {
        return H.br(H.o8(void 0))
    })
    lazy_final($, "A8", "rf", function () {
        return H.br(function () {
            try {
                (void 0).$method$
            } catch (q) {
                return q.message
            }
        }())
    })
    lazy_final($, "Ae", "nw", function () {
        return P._AsyncRun__initializeScheduleImmediate()
    })
    lazy_final($, "Aa", "rh", function () {
        return new P.km().$0()
    })
    lazy_final($, "Ab", "ri", function () {
        return new P.kl().$0()
    })
    lazy_final($, "vx", "oQ", function () {
        return {}
    })
    lazy_final($, "Af", "rl", function () {
        return P.nQ(["A", "ABBR", "ACRONYM", "ADDRESS", "AREA", "ARTICLE", "ASIDE", "AUDIO", "B", "BDI", "BDO", "BIG", "BLOCKQUOTE", "BR", "BUTTON", "CANVAS", "CAPTION", "CENTER", "CITE", "CODE", "COL", "COLGROUP", "COMMAND", "DATA", "DATALIST", "DD", "DEL", "DETAILS", "DFN", "DIR", "DIV", "DL", "DT", "EM", "FIELDSET", "FIGCAPTION", "FIGURE", "FONT", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HGROUP", "HR", "I", "IFRAME", "IMG", "INPUT", "INS", "KBD", "LABEL", "LEGEND", "LI", "MAP", "MARK", "MENU", "METER", "NAV", "NOBR", "OL", "OPTGROUP", "OPTION", "OUTPUT", "P", "PRE", "PROGRESS", "Q", "S", "SAMP", "SECTION", "SELECT", "SMALL", "SOURCE", "SPAN", "STRIKE", "STRONG", "SUB", "SUMMARY", "SUP", "TABLE", "TBODY", "TD", "TEXTAREA", "TFOOT", "TH", "THEAD", "TIME", "TR", "TRACK", "TT", "U", "UL", "VAR", "VIDEO", "WBR"], t.N)
    })
    lazy_final($, "vD", "mH", function () {
        return J.lX(P.m3(), "Opera", 0)
    })
    lazy_final($, "vC", "oV", function () {
        return !$.mH() && J.lX(P.m3(), "Trident/", 0)
    })
    lazy_final($, "vB", "oU", function () {
        return J.lX(P.m3(), "Firefox", 0)
    })
    lazy_final($, "vA", "oT", function () {
        return "-" + $.oW() + "-"
    })
    lazy_final($, "vE", "oW", function () {
        if ($.oU()) var q = "moz"
        else if ($.oV()) q = "ms"
        else q = $.mH() ? "o" : "webkit"
        return q
    })
    lazy_old($, "zB", "iM", function () {
        return new X.je().$0()
    })
    lazy_old($, "vz", "oS", function () {
        return new X.j9().$0()
    })
    lazy_old($, "Ay", "rn", function () {
        return P.RegExp_RegExp("\\?\\?\\?")
    })
    lazy_old($, "Ax", "bV", function () {
        return new S.fK()
    })
    lazy_old($, "zJ", "bU", function () {
        return W.nK()
    })
    lazy_old($, "Av", "rm", function () {
        return P.RegExp_RegExp("\\[.*?\\]")
    })
    lazy_old($, "zT", "d7", function () {
        return 21
    })
    lazy_old($, "zV", "nv", function () {
        return new Sgls.k4().$0()
    })
    lazy_old($, "zS", "nt", function () {
        return P.rM(t.X)
    })
    lazy_old($, "zU", "nu", function () {
        var q = W.j4()
        q.width = 16
        q.height = 16
        return q
    })
    lazy_old($, "zW", "lS", function () {
        var q = W.j4()
        q.width = 16
        q.height = 16
        return q
    })
    lazy_old($, "zX", "d8", function () {
        var q = $.lS()
        q = (q && C.H).geJ(q)
        return (q && C.k).eN(q, 16, 16)
    })
    lazy_old($, "Az", "ro", function () {
        return P.o_()
    })
    // MARK: 字符串反混淆
    lazy_old($, "yg", "cl", function () {
        // return LangData.j("bB", 89)
        return "!"
    })
    lazy_old($, "y0", "lO", function () {
        // return LangData.j("YA", 51)
        return "+"
    })
    lazy_old($, "y3", "n3", function () {
        // return LangData.j("CA", 66)
        return "@"
    })
    lazy_old($, "y4", "aD", function () {
        // return LangData.j("{[A", 63)
        return "@!"
    })
    lazy_old($, "ya", "n5", function () {
        // return LangData.j("DA", 57)
        return ":"
    })
    lazy_old($, "yh", "qc", function () {
        // return LangData.j("l1C~5RJB", 71)
        return "!test!"
    })
    lazy_old($, "zm", "nk", function () {
        // return LangData.j("lA", 39)
        return "\u0002"
    })
    lazy_old($, "zn", "qR", function () {
        // return LangData.j("iA", 33)
        return "\u0003"
    })
    lazy_old($, "yN", "iK", function () {
        // return O.j("=+A", 37)
        return "??"
    })
    lazy_old($, "y2", "d2", function () {
        // return LangData.j("+R/Iv*Y(WVEu;E", 21)
        return "assassinate"
    })
    lazy_old($, "yi", "d3", function () {
        // return LangData.j("<R;2&`|zWV", 30)
        return "exchange"
    })
    lazy_old($, "ym", "eZ", function () {
        // return LangData.j("U|,?M", 1)
        return "half"
    })
    lazy_old($, "y7", "a7", function () {
        // return LangData.j("@k%.*'GC", 5)
        return "charge"
    })
    lazy_old($, "yk", "eY", function () {
        // return LangData.j("K[WvM", 87)
        return "fire"
    })
    lazy_old($, "yr", "bS", function () {
        // return LangData.j("OZFE", 74)
        return "ice"
    })
    lazy_old($, "y_", "lN", function () {
        // return LangData.j("w1{fb_W(wTt-B", 16)
        return "accumulate"
    })
    lazy_old($, "yK", "bT", function () {
        // return LangData.j("PGOv0X*A", 77)
        return "piston"
    })
    lazy_old($, "y5", "aJ", function () {
        return LangData.j("xQrBQ}JLA", 99)
    })
    lazy_old($, "y8", "aE", function () {
        return LangData.j("h)T*jpA", 81)
    })
    lazy_old($, "ye", "bh", function () {
        return LangData.j("ayfH8tA", 39)
    })
    lazy_old($, "yt", "n7", function () {
        return LangData.j("c6sZK", 71)
    })
    lazy_old($, "zj", "bi", function () {
        return LangData.j("EaS1c", 5)
    })
    lazy_old($, "yo", "d4", function () {
        return LangData.j("9s|Y@jA", 81)
    })
    lazy_old($, "yc", "iJ", function () {
        return LangData.j("V_%Fz%}cF", 48)
    })
    lazy_old($, "zg", "lR", function () {
        // return LangData.j("LGI)Za A", 74)
        return "shield"
    })
    lazy_old($, "yL", "d6", function () {
        return LangData.j("r9sG{s5|C", 36)
    })
    lazy_old($, "zo", "nl", function () {
        return LangData.j("Z430:)1HG", 4)
    })
    lazy_old($, "yf", "lP", function () {
        return LangData.j("e'teI>NNCU", 17)
    })
    lazy_old($, "zA", "qZ", function () {
        return LangData.j("CXmc>1nB", 39)
    })
    lazy_old($, "ze", "qM", function () {
        // return LangData.j("qnQymy)B", 38)
        return "shadow"
    })
    lazy_old($, "zl", "qQ", function () {
        return LangData.j("WG/z.8^B", 55)
    })
    lazy_old($, "yE", "na", function () {
        // return LangData.j("EMzI&'T=]Q:wUF", 13)
        return "minionCount"
    })
    lazy_old($, "y6", "n4", function () {
        // return LangData.j("1m3tkgG&,{P", 97)
        return "bossName_"
    })
    lazy_old($, "yB", "lQ", function () {
        return LangData.j("6ct2H)A", 11)
    })
    lazy_old($, "zk", "qP", function () {
        return LangData.j("`I|YpgA", 76)
    })
    lazy_old($, "yF", "qo", function () {
        return LangData.j("$v&,:z_4~N", 62)
    })
    lazy_old($, "zz", "qY", function () {
        return LangData.j("jh&DG", 89)
    })
    lazy_old($, "zi", "qO", function () {
        // return LangData.j("~vBK@@A", 29)
        return "slime"
    })
    lazy_old($, "ys", "qh", function () {
        return LangData.j("MWSWRPJLA", 99)
    })
    lazy_old($, "yb", "qb", function () {
        return LangData.j("()9--8A", 54)
    })
    lazy_old($, "y1", "q9", function () {
        return LangData.j(" &~zX$CC", 55)
    })
    lazy_old($, "yy", "d5", function () {
        return LangData.j(":[+0Z", 31)
    })
    lazy_old($, "yd", "ck", function () {
        // return LangData.j("jtK1|]A", 31)
        return "covid"
    })
    lazy_old($, "zc", "qL", function () {
        return LangData.j("ki9e8.M(G", 13)
    })
    lazy_old($, "yP", "iL", function () {
        // return LangData.j("5,G0b3[B", 51)
        return "Rinick"
    })
    lazy_old($, "yw", "n8", function () {
        return LangData.j("<2g5xSgD", 9)
    })
    lazy_old($, "yx", "qk", function () {
        return LangData.j("&N8l5JCD", 30)
    })
    lazy_old($, "yn", "n6", function () {
        return LangData.j("xKHh?e,D", 53)
    })
    lazy_old($, "yA", "n9", function () {
        return LangData.j("]Kp3u~>B", 31)
    })
    lazy_old($, "zx", "no", function () {
        return LangData.j(")a/8n!RE", 83)
    })
    lazy_old($, "zs", "nm", function () {
        return LangData.j("{MxpF,@rO?LB", 82)
    })
    lazy_old($, "yM", "nb", function () {
        return LangData.j("nS)Vs$[ M^3", 86)
    })
    lazy_old($, "y9", "qa", function () {
        return LangData.j("lbb@`TID", 19)
    })
    lazy_old($, "zu", "nn", function () {
        return LangData.j("`:W7Ze/ON.S+HIW", 22)
    })
    lazy_old($, "zv", "qW", function () {
        return LangData.j("&%v5AaC/]<&>Z^X0#B", 58)
    })
    lazy_old($, "zy", "np", function () {
        return LangData.j("_?d>JT-C", 37)
    })
    lazy_old($, "yu", "qi", function () {
        return LangData.j("udp%0&+$r>dB", 94)
    })
    lazy_old($, "zh", "nj", function () {
        return LangData.j("vx;rs", 50)
    })
    lazy_old($, "yI", "qr", function () {
        return LangData.j("7YF", 48)
    })
    lazy_old($, "yJ", "qs", function () {
        return LangData.j("KYXO", 32)
    })
    lazy_old($, "zr", "qU", function () {
        return LangData.j("2V~6yfHkOb>", 49)
    })
    lazy_old($, "yq", "qg", function () {
        return LangData.j("oz%!U'YF", 73)
    })
    lazy_old($, "yv", "qj", function () {
        return LangData.j("b@U>k|&P@hk", 0)
    })
    lazy_old($, "yO", "qt", function () {
        return LangData.j("ihMZ}G'RC", 77)
    })
    lazy_old($, "zw", "qX", function () {
        return LangData.j("[w9L]M/>Ge/", 38)
    })
    lazy_old($, "yp", "qf", function () {
        return LangData.j("@9Y.X", 51)
    })
    lazy_old($, "zf", "qN", function () {
        return LangData.j("?%#<WpDE", 10)
    })
    lazy_old($, "yj", "qd", function () {
        return LangData.j(",VV7pFUD", 15)
    })
    lazy_old($, "zq", "qT", function () {
        return LangData.j("lzG^ex`E", 72)
    })
    lazy_old($, "zt", "qV", function () {
        return LangData.j("*s]_EKXQ}W", 26)
    })
    lazy_old($, "yz", "ql", function () {
        return LangData.j("<'L]+.]lLrYB", 65)
    })
    lazy_old($, "zp", "qS", function () {
        return LangData.j("U`-Rl!IF", 73)
    })
    lazy_old($, "yl", "qe", function () {
        return LangData.j("?hEGt00!>5nL[OI", 41)
    })
    lazy_old($, "zd", "ni", function () {
        // return LangData.j("tU`0/mA", 2)
        return "seed:"
    })
    lazy_old($, "yC", "qm", function () {
        // return LangData.j(";kC;Z", 12)
        return "dio"
    })
    lazy_old($, "yD", "qn", function () {
        return LangData.j("Ox2j(}6B", 62)
    })
    lazy_old($, "zb", "nh", function () {
        return LangData.j("[uA.6OlzvO7Io;KYC<#H!O04nL9lDiKDyXAl?D", 53)
    })
    lazy_old($, "z5", "nf", function () {
        return LangData.j("yW+04ekCs/(`M<^%pzOPaP!1g.9`f=6Iowx7KqyA", 12)
    })
    lazy_old($, "yZ", "qA", function () {
        return LangData.j("k/#av`/R%K.8Z7cPJ9pwz`{AF+bl~3A#IuZEVK'4QE", 95)
    })
    lazy_old($, "z_", "qB", function () {
        return LangData.j("v$CbW=5[7IUs)PPLW,sxa=*&f1P>)'phAl2JRm,c,S", 83)
    })
    lazy_old($, "z0", "qC", function () {
        return LangData.j("teGc0KOSrNDn<3!fVR;xwKG}r,gwB5]wrX:A]M-i)A", 47)
    })
    lazy_old($, "yS", "qv", function () {
        return LangData.j("~6[*>;8,bI~u#l=L&&YF];/;,IMvuigm*[3EuNSB", 81)
    })
    lazy_old($, "yW", "ne", function () {
        return LangData.j("HOa,^Auk1x84LRKOnLivoA,^CvRYpI$Y&JxtF7P", 33)
    })
    lazy_old($, "yX", "qy", function () {
        return LangData.j("r;.1;m!Y`$*76X[kFwDg?m<on%f`.X:NNRQ)s^v=4G", 24)
    })
    lazy_old($, "yY", "qz", function () {
        return LangData.j("|Y`+RJRHLN.p,;hg%L5FNJDN7MKOXiBKr0vtWyC!eD", 45)
    })
    lazy_old($, "yQ", "qu", function () {
        return LangData.j("4TmcbC~p%FZ3OG+Nv~jBrzk7&MBPvE-'xObSK3%KlTmcRUA", 35)
    })
    lazy_old($, "yR", "nc", function () {
        return LangData.j("j||XsipWY) l7j11O!(Mqi^.bZXl$Gh1z0YF~kMkhwe", 68)
    })
    lazy_old($, "yT", "nd", function () {
        return LangData.j("[IwfNb&!5RS,05|n#na1Jbyuc9[0Gb?M`.w)|/~zD", 7)
    })
    lazy_old($, "yV", "qx", function () {
        // return LangData.j("ai[u(+{WLzw?FbpUW~44<j{#'ZHo<,YST,twmLV9D", 72)
        return "<div class=\"smile s_curse\"></div>"
    })
    lazy_old($, "z1", "qD", function () {
        return LangData.j("m^Jd-SooyPlLaL/Ysyzz;S1Xa8kh4Zid1[SY;Ez^Jd8D", 59)
    })
    lazy_old($, "z2", "qE", function () {
        return LangData.j("gM2vT&:&)xr*lb#RYZ:ZP&#[`yi*b5+ho<2JdcW<H", 64)
    })
    lazy_old($, "z3", "qF", function () {
        return LangData.j("U4|wQ;P'v0hw&aSMs)SbU;f[=1U-}*cln4|w./A", 80)
    })
    lazy_old($, "z4", "qG", function () {
        return LangData.j("j||XsipWY) l7j11O!(Mqi^.^v(d`hFV;7p4YRdB", 68)
    })
    lazy_old($, "z6", "qH", function () {
        return LangData.j("yW+04ekCs/(`M<^%pzOPaP!1*:+)XT_QG)Jj;j9,fE", 12)
    })
    lazy_old($, "z8", "ng", function () {
        return LangData.j("_vW+4>&y~Iv0z?VN#;^E8>?3&Gow5j0Q0fK1Ei/RoS", 85)
    })
    lazy_old($, "z9", "qJ", function () {
        return LangData.j("SWAyuI%B&,6%p;k8VH,Nd %*JE53*T,AxA#v{MB", 44)
    })
    lazy_old($, "yU", "qw", function () {
        // return LangData.j("Gc[I~fhNT#6]XuGrfUx.`fSI=!'?Pa~kiiRw<W:o&UY", 14)
        return "<div class=\"smile s_counter\"></div>"
    })
    lazy_old($, "z7", "qI", function () {
        return LangData.j(">)z*M_<GhK0#T? P13VEIrAGEEjU3&ibv`7H'#?+@iM", 93)
    })
    lazy_old($, "za", "qK", function () {
        return LangData.j("4TmcbC~p%FZ3OG+NROs)LBB[)kvXjGQy?A8^J'Kzl-B", 35)
    })
    lazy_old($, "yG", "qp", function () {
        // return O.j("H<|dA6D5:4]j*v#HA'XH>zwoSP", 57)
        return "deepmess.com/namerena"
    })
    lazy_old($, "yH", "qq", function () {
        // return O.j("0fc/5.@{T*a]T^#TU9!P(q*yRaP@yG*Vp>'aEnltB", 31)
        return "https://deepmess.com/zh/namerena/"
    })
    lazy_old($, "zN", "nr", function () {
        return P.dD([LangData.j("JIi6cgXO*d_", 22), $.iH(), LangData.j("Fmi6Vr!~c@]4ElFk,dC", 55), $.mO(), LangData.j("OeQh>Rep f~;YzR^Y%E", 16), $.lK()], t.X, t.B)
    })
    lazy_old($, "zE", "r0", function () {
        return P.RegExp_RegExp("^\\s+[:@]*\\s*")
    })
    lazy_old($, "zF", "nq", function () {
        return P.RegExp_RegExp("\\s+$")
    })
    lazy_old($, "zD", "r_", function () {
        return P.RegExp_RegExp("\\r?\\n")
    })
    // MARK: 空 RunUpdate
    lazy_old($, "zR", "K", function () {
        var q = null
        return T.RunUpdate("\n", q, q, q, q, 0, 1000, 100)
    })
    lazy_old($, "vq", "rp", function () {
        return $.mS()
    })
    lazy_old($, "vr", "rq", function () {
        return $.C()
    })
    // MARK: 数字反混淆
    lazy_old($, "wX", "at", function () {
        return X.k("vF:G*ee&GC", 12)
    })
    lazy_old($, "vF", "a", function () {
        // return X.k("IIq4zN_QaD", 19)
        return 0
    })
    lazy_old($, "vP", "i", function () {
        return X.k("P1JU9kNX~I", 52)
    })
    lazy_old($, "wr", "t", function () {
        // return X.k("Oi}Eh'8SJR", 99)
        return 2
    })
    lazy_old($, "wn", "ph", function () {
        return X.D("od`D$R=0SJ", 85)
    })
    lazy_old($, "vY", "cZ", function () {
        return X.k("5>pu'qyiIM", 70)
    })
    lazy_old($, "xq", "pM", function () {
        return X.k("_a3=L4dckG", 37)
    })
    lazy_old($, "xe", "lM", function () {
        return X.k("p,,c!10-FQ", 93)
    })
    lazy_old($, "wq", "pj", function () {
        return X.D("qCDXr5,MXA", 61)
    })
    lazy_old($, "wp", "pi", function () {
        return X.D("Lo=*]5Lg#G", 25)
    })
    lazy_old($, "w9", "eU", function () {
        return X.k("uo2[vY3QwA", 3)
    })
    lazy_old($, "wQ", "B", function () {
        return X.k("Cv.c@Ovh.D", 22)
    })
    lazy_old($, "wa", "p8", function () {
        return X.k("o8#!>[]y<J", 57)
    })
    lazy_old($, "xn", "mZ", function () {
        return X.D(" 2[vLvtX:A", 68)
    })
    lazy_old($, "wl", "eV", function () {
        return X.D("6Ce~JmtqSF", 71)
    })
    lazy_old($, "xu", "a6", function () {
        return X.k("&xM6z,hd#O", 85)
    })
    lazy_old($, "vR", "ci", function () {
        return X.k("WxPb+b%'LN", 76)
    })
    lazy_old($, "ws", "as", function () {
        return X.k("*:%S'eXt!J", 56)
    })
    lazy_old($, "xt", "a4", function () {
        // return X.k("`8fQ/CxFQA", 2)
        return 6
    })
    lazy_old($, "xA", "au", function () {
        return X.k("[kT:g-|3XH", 42)
    })
    lazy_old($, "w1", "cj", function () {
        return X.D("`H)#qK]@HN", 15)
    })
    lazy_old($, "xG", "ap", function () {
        return X.k("j1 6(jNX~I", 52)
    })
    lazy_old($, "vO", "p1", function () {
        // return X.D("%>;B.O6'DA", 63)
        return 0.7799999713897705
    })
    lazy_old($, "vK", "b0", function () {
        return X.D("KvLG}E$m7J", 7)
    })
    lazy_old($, "xc", "C", function () {
        // return X.k("T,tQQy%'LN", 76)
        return 4
    })
    lazy_old($, "wH", "eX", function () {
        // return X.k("$YcaZZ:WUG", 36)
        return 256
    })
    lazy_old($, "wk", "pf", function () {
        return X.D("NS 98:}]PR", 92)
    })
    lazy_old($, "wm", "pg", function () {
        return X.D("pa+s[!w!iR", 91)
    })
    lazy_old($, "xh", "pK", function () {
        return X.k("KW3YIK.WUG", 36)
    })
    lazy_old($, "xN", "b3", function () {
        // return X.k("}:|quIE(@P", 92)
        return 80
    })
    lazy_old($, "vQ", "Z", function () {
        // return X.k("F]CU/7E(@P", 92)
        return 10
    })
    lazy_old($, "wN", "pw", function () {
        return X.D("4S|&JW$AZI", 32)
    })
    lazy_old($, "vG", "ao", function () {
        return X.D("G*Oej(8SJR", 99)
    })
    lazy_old($, "wo", "mM", function () {
        return X.D("15uE1}!JpC", 7)
    })
    lazy_old($, "x8", "pG", function () {
        return X.k(",c 1O:RhDB", 6)
    })
    lazy_old($, "xk", "pL", function () {
        return X.k("O[u;0UIM7I", 50)
    })
    lazy_old($, "xp", "b1", function () {
        return X.k("wuf,zOjn(G", 39)
    })
    lazy_old($, "xX", "q7", function () {
        return X.k("F lu;X_QaD", 38)
    })
    lazy_old($, "xM", "av", function () {
        return X.k("3u,161Bd^L", 69)
    })
    lazy_old($, "xw", "pQ", function () {
        return X.D("v_v-8FUs/M", 8)
    })
    lazy_old($, "vT", "cX", function () {
        return X.k("@Ii!xsrBxF", 64)
    })
    lazy_old($, "ww", "bx", function () {
        // return X.k("27>.]$_<VQ", 94)
        return 2048
    })
    lazy_old($, "xd", "bg", function () {
        return X.k("5+yzR?1-FQ", 93)
    })
    lazy_old($, "vM", "p0", function () {
        return X.D("u<0ts= S_V", 64)
    })
    lazy_old($, "xf", "pJ", function () {
        return X.D("%xD:GhI4QU", 48)
    })
    lazy_old($, "vU", "lG", function () {
        // return X.D("'00dRlSitU", 54)
        return 10
    })
    lazy_old($, "vW", "p3", function () {
        return X.k("`aa.s&j;mC", 14)
    })
    lazy_old($, "wD", "pq", function () {
        return X.k("y{5]U4S1PH", 83)
    })
    lazy_old($, "w0", "d_", function () {
        // return X.k("?`C3ou}R1L", 67)
        return 128
    })
    lazy_old($, "wj", "pe", function () {
        return X.D("ThP:gnU]RI", 16)
    })
    lazy_old($, "vH", "oX", function () {
        return X.D("+9[Q]5LgfG", 25)
    })
    lazy_old($, "xo", "X", function () {
        return X.k("BW1,-W.WUG", 36)
    })
    lazy_old($, "wO", "px", function () {
        return X.D("6+S>Rm<-VA", 65)
    })
    lazy_old($, "vL", "p_", function () {
        return X.D("Y?&-AHv0II", 16)
    })
    lazy_old($, "vN", "mI", function () {
        return X.D("dV~?xZecyE", 37)
    })
    lazy_old($, "vI", "oY", function () {
        return X.D("R<[dAHv0^H", 16)
    })
    lazy_old($, "xK", "pZ", function () {
        return X.D("Pb8apiJXjT", 50)
    })
    lazy_old($, "x7", "mU", function () {
        return X.k("+O2YYGy,+H", 45)
    })
    lazy_old($, "vJ", "oZ", function () {
        return X.D("xF s,sTeiD", 45)
    })
    lazy_old($, "wS", "mR", function () {
        return X.k("<1<l6S%nuJ", 55)
    })
    lazy_old($, "wC", "eW", function () {
        return X.k("(R5/YDj;mC", 28)
    })
    lazy_old($, "xl", "aI", function () {
        return X.k(")>]w@n)xzB", 9)
    })
    lazy_old($, "wV", "pz", function () {
        return X.D("hgirj(8S{F", 99)
    })
    lazy_old($, "wU", "py", function () {
        return X.D("Bg(8GhGi[T", 48)
    })
    lazy_old($, "wR", "lI", function () {
        return X.k("uEp>@P0sNE", 48)
    })
    lazy_old($, "x4", "lK", function () {
        return X.k("BcQuPEPOSD", 37)
    })
    lazy_old($, "xV", "q5", function () {
        return X.k("_qlY:A@~RE", 97)
    })
    lazy_old($, "xH", "pW", function () {
        return X.k("U>JaC))L?F", 34)
    })
    lazy_old($, "wP", "mQ", function () {
        return X.D("a(vr5Q0sQP", 24)
    })
    lazy_old($, "w2", "p6", function () {
        return X.k("j-Da]5rziP", 89)
    })
    lazy_old($, "w8", "aR", function () {
        return X.k("o.qW!KX[gF", 31)
    })
    lazy_old($, "wE", "mO", function () {
        return X.k("#U<=KBe&GC", 24)
    })
    lazy_old($, "wL", "iI", function () {
        return X.k("s4Ff$Io{jB", 16)
    })
    lazy_old($, "vX", "cY", function () {
        return X.k("l@(lK%,MPO", 82)
    })
    lazy_old($, "xz", "b2", function () {
        return X.k("Q9p3NSeckG", 37)
    })
    lazy_old($, "xg", "mV", function () {
        return X.k("cP|R0-|R1L", 67)
    })
    lazy_old($, "w4", "eT", function () {
        return X.k("ji|Q32jBxF", 64)
    })
    lazy_old($, "we", "iH", function () {
        return X.k("6GYapjUG%F", 33)
    })
    lazy_old($, "x1", "mT", function () {
        return X.k("'Y_#*mIydE", 25)
    })
    lazy_old($, "wA", "po", function () {
        return X.k("Vi~q&TZ3'B", 10)
    })
    lazy_old($, "vS", "eS", function () {
        return X.k("L@p[XtryHH", 41)
    })
    lazy_old($, "wt", "lH", function () {
        return X.k("EyW}d_Bc6D", 42)
    })
    lazy_old($, "wT", "lJ", function () {
        return X.k("9 bo->vyHH", 82)
    })
    lazy_old($, "xS", "n2", function () {
        return X.k("CYe ;WIfsG", 75)
    })
    lazy_old($, "wh", "pd", function () {
        return X.k("pPr4b;M|NE", 48)
    })
    lazy_old($, "wz", "mN", function () {
        return X.k("75%]B3 4yP", 90)
    })
    lazy_old($, "xi", "mW", function () {
        return X.k("?B72]Go)^E", 57)
    })
    lazy_old($, "wf", "mL", function () {
        return X.k("'o:uEW5R/I", 51)
    })
    lazy_old($, "w5", "mJ", function () {
        return X.k(")J](DyK=VQ", 94)
    })
    lazy_old($, "wu", "pk", function () {
        return X.D("i]3&hT~B-H", 28)
    })
    lazy_old($, "xR", "q2", function () {
        return X.k("x7KOo1~b6D", 21)
    })
    lazy_old($, "wg", "pc", function () {
        return X.k(",7Wg$o8b>A", 5)
    })
    lazy_old($, "wB", "pp", function () {
        return X.k("sy_Q{nF(@P", 92)
    })
    lazy_old($, "wi", "T", function () {
        // return X.D("xPJ>uk!c<B", 53)
        return 1
    })
    lazy_old($, "xa", "lL", function () {
        return X.k("F(#M*C?F`C", 34)
    })
    lazy_old($, "wW", "d1", function () {
        return X.k("p&kJ 5Q!{M", 75)
    })
    lazy_old($, "xj", "mX", function () {
        return X.k("^M0K:>w!&P", 91)
    })
    lazy_old($, "xF", "n0", function () {
        return X.k("ISp/mK84,M", 74)
    })
    lazy_old($, "wM", "pv", function () {
        return X.k("GiA5WP.8[B", 11)
    })
    lazy_old($, "xJ", "pY", function () {
        return X.k("EK3xBLQz4M", 73)
    })
    lazy_old($, "xI", "pX", function () {
        return X.k("Eh~/5KGoYM", 71)
    })
    lazy_old($, "xb", "pI", function () {
        return X.k("sL|G/'Bd^L", 69)
    })
    lazy_old($, "xL", "q_", function () {
        return X.k(">uy0Rt=+WC", 13)
    })
    lazy_old($, "xE", "pV", function () {
        return X.k("y&D50SrziP", 89)
    })
    lazy_old($, "xD", "pU", function () {
        return X.k("3M:L}N@i=O", 86)
    })
    lazy_old($, "xQ", "q1", function () {
        return X.k("~bL%3?)L?F", 34)
    })
    lazy_old($, "wG", "mP", function () {
        return X.k("[V-z)3H<`H", 46)
    })
    lazy_old($, "wd", "pb", function () {
        return X.k(",r=TU*tMlL", 66)
    })
    lazy_old($, "xP", "q0", function () {
        return X.k("0X)=.x6uSP", 88)
    })
    lazy_old($, "x5", "pE", function () {
        return X.k("w~Ou?!0.eC", 27)
    })
    lazy_old($, "wZ", "mS", function () {
        // return X.k("dG|*}T{.AF", 29)
        return 32768
    })
    lazy_old($, "xy", "n_", function () {
        return X.k("*,uU([GoYM", 71)
    })
    lazy_old($, "wJ", "pt", function () {
        return X.k(")~>SOZS1PH", 83)
    })
    lazy_old($, "x2", "pC", function () {
        return X.k(">Lk@cu3H*Q", 97)
    })
    lazy_old($, "x6", "pF", function () {
        // return X.k("|@?Of-toCP", 87)
        return 3517
    })
    lazy_old($, "wy", "pn", function () {
        // return X.k("v8kF:K:=`H", 46)
        return 20897
    })
    lazy_old($, "wb", "p9", function () {
        // return X.k("AL&(*/#5BK", 58)
        return 16468
    })
    lazy_old($, "xs", "pO", function () {
        // return X.k("rO!p(83H*Q", 97)
        return 57
    })
    lazy_old($, "xW", "q6", function () {
        // return X.k("!%REZf|.IF", 59)
        return 97
    })
    lazy_old($, "w_", "p5", function () {
        return X.k("ssdUZ-o{jB", 16)
    })
    lazy_old($, "xC", "pT", function () {
        return X.k("3=FRq0=+WC", 13)
    })
    lazy_old($, "xT", "q3", function () {
        return X.k(">(E4.I@i=O", 86)
    })
    lazy_old($, "wc", "pa", function () {
        return X.D("q;}N|c|3wS", 42)
    })
    lazy_old($, "x0", "pB", function () {
        return X.D("}2ZxxZec)R", 37)
    })
    lazy_old($, "xB", "pS", function () {
        return X.D("'%s.<Y.W9R", 36)
    })
    lazy_old($, "wI", "ps", function () {
        // return X.D("Ot`&?l'nHU", 55)
        return 256
    })
    lazy_old($, "wx", "pm", function () {
        // return X.D(";lV$g3/|;B", 80)
        return 2048
    })
    lazy_old($, "x_", "W", function () {
        // return X.D("2(:ub1V-+B", 77)
        return 32768
    })
    lazy_old($, "xO", "n1", function () {
        return X.D("Jn|940%'0C", 76)
    })
    lazy_old($, "x3", "pD", function () {
        return X.k("AQI,4l~@gF", 31)
    })
    lazy_old($, "w7", "mK", function () {
        return X.k(")pwk@R3QwA", 3)
    })
    lazy_old($, "vV", "p2", function () {
        return X.k("<hZu12tX)L", 68)
    })
    lazy_old($, "w3", "p7", function () {
        return X.k("jZ>0V$cSfO", 83)
    })
    lazy_old($, "wK", "pu", function () {
        return X.k("C<7,}Y`[?K", 63)
    })
    lazy_old($, "xx", "pR", function () {
        // return X.k("=mymvqAAAA", 0)
        return 61
    })
    lazy_old($, "wF", "pr", function () {
        return X.k("OsofdmW-bN", 77)
    })
    lazy_old($, "w6", "d0", function () {
        return X.k("_lv_}:$R/I", 51)
    })
    lazy_old($, "vZ", "p4", function () {
        return X.k("@:On3OXckG", 37)
    })
    lazy_old($, "xU", "q4", function () {
        return X.k("0iPS=<oyHH", 41)
    })
    lazy_old($, "wv", "pl", function () {
        return X.D("WT)~pf:~hB", 91)
    })
    lazy_old($, "xm", "mY", function () {
        // return X.k("T)Ok_x`s]G", 40)
        return 480
    })
    lazy_old($, "xv", "pP", function () {
        return X.D("wrWW R:IqQ", 26)
    })
    lazy_old($, "wY", "pA", function () {
        return X.k("]F8Q`2,8[B", 11)
    })
    lazy_old($, "x9", "pH", function () {
        return X.k("^@!Hqw8SJR", 99)
    })
    lazy_old($, "xr", "pN", function () {
        return X.k("09zY7g53tE", 26)
    })
    lazy_old($, "xY", "q8", function () {
        return X.k("}-?M/~zGrI", 98)
    })
    lazy_old($, "zO", "r4", function () {
        return P.o_()
    })
    // lazy_old($, "mc", "ns", function () {
    //     // return 0
    //     return 0
    // })
    lazy_old($, "ta", "r2", function () {
        return $.mb + $.d_()
    })
    lazy_old($, "tb", "r3", function () {
        return 0
    })
    lazy_old($, "zH", "r1", function () {
        // return H.b([$.iL(), $.n8(), $.qk(), $.n6(), $.n9(), $.no(), $.nm(), $.nb(), $.qa(), $.nn(), $.qW(), $.np(), $.qi(), $.nj(), $.qr(), $.qs(), $.qU()], t.V)
        return H.b(
            [
                "Rinick", "库瓒", "庫瓒", "涵虚", "霛雲", "云剑", "新纪元", "琪拉拉", "纯菜", "学车中学",
                "学🚗🀄学", "昀澤", "锦依卫", "Σσ", "Ø", "∅", "斜眼笑"
            ],
            t.V
        )
    })
    lazy_old($, "zQ", "r5", function () {
        return $.pA()
    })
    lazy_old($, "zY", "r6", function () {
        return C.Array.f5(H.b(LangData.get_lang("ezfN").split("[]"), t.s), new T.kb(), t.X).fL(0)
    })
    lazy_old($, "Ac", "rj", function () {
        // 武器那一堆
        // return P.dD([LangData.j("e%XTi8O%`kSB", 94), new T.kq(), LangData.j("yz*^A*wx}^-:r`d", 95), new T.kr(), LangData.j("^dYkSp{^[&&o2d0:E2E", 59), new T.ks(), LangData.j("~47]&y= +_5ji7P", 85), new T.kt(), LangData.j("l+&iUIpO;.M(}FX", 23), new T.ku()], t.X, H.find_type("bL*(m*,u*)*"))
        return P.dD([
            "剁手刀",
            new T.kq(),
            "死亡笔记",
            new T.kr(),
            "属性修改器",
            new T.ks(),
            "桂月奖杯",
            new T.kt(),
            "玄月奖杯",
            new T.ku()
        ], t.X, H.findType("bL*(m*,u*)*"))
    })
    lazy_old($, "Ad", "rk", function () {
        // return H.b([$.iL(), $.n8(), $.n6(), $.n9(), $.no(), $.nm(), $.nb(), $.nn(), $.np(), $.nj(), $.qg(), $.qj(), $.qt(), $.qX(), $.qf(), $.qN(), $.qd(), $.qT(), $.qV(), $.ql(), $.qS(), $.qe()], t.V)
        return H.b(
            [
                "Rinick", "库瓒", "涵虚", "霛雲", "云剑", "新纪元", "琪拉拉", "学车中学", "昀澤",
                "Σσ", "滑稽", "坤灵剑", "RailGun", "巡洋舰", "Hell", "佘山", "房刚", "五班", "XJ联队",
                "乐正绫", "文哥", "geometrydash"
            ],
            t.V
        )
    })
    lazy_old($, "AA", "nx", function () {
        return new P.cK(null, null, null, H.findType("cK<m*>"))
    })
})();
// MARK: Native support
(function nativeSupport() {
    ! function () {

        init.getIsolateTag = function (a) {
            return "___dart_" + a + init.isolateTag
        }
        var r = "___dart_isolate_tags_"
        var q = Object[r] || (Object[r] = Object.create(null))
        var p = "_ZxYxX"
        for (var o = 0; ; o++) {
            var n = p + "_" + o + "_"
            if (!(n in q)) {
                q[n] = 1
                init.isolateTag = n
                break
            }
        }
        init.dispatchPropertyName = init.getIsolateTag("dispatch_record")
    }()
    hunkHelpers.setOrUpdateInterceptorsByTag({
        DOMError: J.Interceptor,
        DOMImplementation: J.Interceptor,
        MediaError: J.Interceptor,
        Navigator: J.Interceptor,
        NavigatorConcurrentHardware: J.Interceptor,
        NavigatorUserMediaError: J.Interceptor,
        OverconstrainedError: J.Interceptor,
        PositionError: J.Interceptor,
        GeolocationPositionError: J.Interceptor,
        Range: J.Interceptor,
        TextMetrics: J.Interceptor,
        SQLError: J.Interceptor,
        ArrayBuffer: H.dJ,
        DataView: H.ab,
        ArrayBufferView: H.ab,
        Float32Array: H.NativeTypedArrayOfDouble,
        Float64Array: H.NativeTypedArrayOfDouble,
        Int16Array: H.fE,
        Int32Array: H.fF,
        Int8Array: H.fG,
        Uint16Array: H.fH,
        Uint32Array: H.fI,
        Uint8ClampedArray: H.dL,
        CanvasPixelArray: H.dL,
        Uint8Array: H.cx,
        HTMLAudioElement: W.HtmlElement,
        HTMLBRElement: W.HtmlElement,
        HTMLButtonElement: W.HtmlElement,
        HTMLContentElement: W.HtmlElement,
        HTMLDListElement: W.HtmlElement,
        HTMLDataElement: W.HtmlElement,
        HTMLDataListElement: W.HtmlElement,
        HTMLDetailsElement: W.HtmlElement,
        HTMLDialogElement: W.HtmlElement,
        HTMLEmbedElement: W.HtmlElement,
        HTMLFieldSetElement: W.HtmlElement,
        HTMLHRElement: W.HtmlElement,
        HTMLHeadElement: W.HtmlElement,
        HTMLHeadingElement: W.HtmlElement,
        HTMLHtmlElement: W.HtmlElement,
        HTMLIFrameElement: W.HtmlElement,
        HTMLImageElement: W.HtmlElement,
        HTMLInputElement: W.HtmlElement,
        HTMLLIElement: W.HtmlElement,
        HTMLLabelElement: W.HtmlElement,
        HTMLLegendElement: W.HtmlElement,
        HTMLLinkElement: W.HtmlElement,
        HTMLMapElement: W.HtmlElement,
        HTMLMediaElement: W.HtmlElement,
        HTMLMenuElement: W.HtmlElement,
        HTMLMetaElement: W.HtmlElement,
        HTMLMeterElement: W.HtmlElement,
        HTMLModElement: W.HtmlElement,
        HTMLOListElement: W.HtmlElement,
        HTMLObjectElement: W.HtmlElement,
        HTMLOptGroupElement: W.HtmlElement,
        HTMLOptionElement: W.HtmlElement,
        HTMLOutputElement: W.HtmlElement,
        HTMLParamElement: W.HtmlElement,
        HTMLPictureElement: W.HtmlElement,
        HTMLPreElement: W.HtmlElement,
        HTMLProgressElement: W.HtmlElement,
        HTMLQuoteElement: W.HtmlElement,
        HTMLScriptElement: W.HtmlElement,
        HTMLShadowElement: W.HtmlElement,
        HTMLSlotElement: W.HtmlElement,
        HTMLSourceElement: W.HtmlElement,
        HTMLStyleElement: W.HtmlElement,
        HTMLTableCaptionElement: W.HtmlElement,
        HTMLTableColElement: W.HtmlElement,
        HTMLTextAreaElement: W.HtmlElement,
        HTMLTimeElement: W.HtmlElement,
        HTMLTitleElement: W.HtmlElement,
        HTMLTrackElement: W.HtmlElement,
        HTMLUListElement: W.HtmlElement,
        HTMLUnknownElement: W.HtmlElement,
        HTMLVideoElement: W.HtmlElement,
        HTMLDirectoryElement: W.HtmlElement,
        HTMLFontElement: W.HtmlElement,
        HTMLFrameElement: W.HtmlElement,
        HTMLFrameSetElement: W.HtmlElement,
        HTMLMarqueeElement: W.HtmlElement,
        HTMLElement: W.HtmlElement,
        HTMLAnchorElement: W.AnchorElement,
        HTMLAreaElement: W.AreaElement,
        HTMLBaseElement: W.BaseElement,
        Blob: W.Blob,
        HTMLBodyElement: W.BodyElement,
        HTMLCanvasElement: W.CanvasElement,
        CanvasRenderingContext2D: W.CanvasRenderingContext2D,
        CDATASection: W.b6,
        CharacterData: W.b6,
        Comment: W.b6,
        ProcessingInstruction: W.b6,
        Text: W.b6,
        CSSStyleDeclaration: W.co,
        MSStyleCSSProperties: W.co,
        CSS2Properties: W.co,
        CSSStyleSheet: W.dm,
        HTMLDivElement: W.c0,
        DOMException: W.ja,
        DOMTokenList: W.jb,
        Element: W.Element,
        AbortPaymentEvent: W.o,
        AnimationEvent: W.o,
        AnimationPlaybackEvent: W.o,
        ApplicationCacheErrorEvent: W.o,
        BackgroundFetchClickEvent: W.o,
        BackgroundFetchEvent: W.o,
        BackgroundFetchFailEvent: W.o,
        BackgroundFetchedEvent: W.o,
        BeforeInstallPromptEvent: W.o,
        BeforeUnloadEvent: W.o,
        BlobEvent: W.o,
        CanMakePaymentEvent: W.o,
        ClipboardEvent: W.o,
        CloseEvent: W.o,
        CustomEvent: W.o,
        DeviceMotionEvent: W.o,
        DeviceOrientationEvent: W.o,
        ErrorEvent: W.o,
        ExtendableEvent: W.o,
        ExtendableMessageEvent: W.o,
        FetchEvent: W.o,
        FontFaceSetLoadEvent: W.o,
        ForeignFetchEvent: W.o,
        GamepadEvent: W.o,
        HashChangeEvent: W.o,
        InstallEvent: W.o,
        MediaEncryptedEvent: W.o,
        MediaKeyMessageEvent: W.o,
        MediaQueryListEvent: W.o,
        MediaStreamEvent: W.o,
        MediaStreamTrackEvent: W.o,
        MIDIConnectionEvent: W.o,
        MIDIMessageEvent: W.o,
        MutationEvent: W.o,
        NotificationEvent: W.o,
        PageTransitionEvent: W.o,
        PaymentRequestEvent: W.o,
        PaymentRequestUpdateEvent: W.o,
        PopStateEvent: W.o,
        PresentationConnectionAvailableEvent: W.o,
        PresentationConnectionCloseEvent: W.o,
        ProgressEvent: W.o,
        PromiseRejectionEvent: W.o,
        PushEvent: W.o,
        RTCDataChannelEvent: W.o,
        RTCDTMFToneChangeEvent: W.o,
        RTCPeerConnectionIceEvent: W.o,
        RTCTrackEvent: W.o,
        SecurityPolicyViolationEvent: W.o,
        SensorErrorEvent: W.o,
        SpeechRecognitionError: W.o,
        SpeechRecognitionEvent: W.o,
        SpeechSynthesisEvent: W.o,
        StorageEvent: W.o,
        SyncEvent: W.o,
        TrackEvent: W.o,
        TransitionEvent: W.o,
        WebKitTransitionEvent: W.o,
        VRDeviceEvent: W.o,
        VRDisplayEvent: W.o,
        VRSessionEvent: W.o,
        MojoInterfaceRequestEvent: W.o,
        ResourceProgressEvent: W.o,
        USBConnectionEvent: W.o,
        IDBVersionChangeEvent: W.o,
        AudioProcessingEvent: W.o,
        OfflineAudioCompletionEvent: W.o,
        WebGLContextEvent: W.o,
        Event: W.o,
        InputEvent: W.o,
        SubmitEvent: W.o,
        EventTarget: W.fn,
        File: W.cq,
        HTMLFormElement: W.fp,
        ImageData: W.c4,
        Location: W.jL,
        MessageEvent: W.c8,
        MessagePort: W.dH,
        MouseEvent: W.bp,
        DragEvent: W.bp,
        PointerEvent: W.bp,
        WheelEvent: W.bp,
        Document: W.v,
        DocumentFragment: W.v,
        HTMLDocument: W.v,
        ShadowRoot: W.v,
        XMLDocument: W.v,
        DocumentType: W.v,
        Node: W.v,
        NodeList: W.dM,
        RadioNodeList: W.dM,
        HTMLParagraphElement: W.dQ,
        HTMLSelectElement: W.h4,
        HTMLSpanElement: W.ek,
        Storage: W.hN,
        StyleSheet: W.bb,
        HTMLTableCellElement: W.ce,
        HTMLTableDataCellElement: W.ce,
        HTMLTableHeaderCellElement: W.ce,
        HTMLTableElement: W.en,
        HTMLTableRowElement: W.hQ,
        HTMLTableSectionElement: W.hR,
        HTMLTemplateElement: W.cI,
        CompositionEvent: W.aY,
        FocusEvent: W.aY,
        KeyboardEvent: W.aY,
        TextEvent: W.aY,
        TouchEvent: W.aY,
        UIEvent: W.aY,
        Window: W.eq,
        DOMWindow: W.eq,
        Attr: W.cL,
        NamedNodeMap: W.ex,
        MozNamedAttrMap: W.ex,
        StyleSheetList: W.eH,
        SVGScriptElement: P.cF,
        SVGAElement: P.p,
        SVGAnimateElement: P.p,
        SVGAnimateMotionElement: P.p,
        SVGAnimateTransformElement: P.p,
        SVGAnimationElement: P.p,
        SVGCircleElement: P.p,
        SVGClipPathElement: P.p,
        SVGDefsElement: P.p,
        SVGDescElement: P.p,
        SVGDiscardElement: P.p,
        SVGEllipseElement: P.p,
        SVGFEBlendElement: P.p,
        SVGFEColorMatrixElement: P.p,
        SVGFEComponentTransferElement: P.p,
        SVGFECompositeElement: P.p,
        SVGFEConvolveMatrixElement: P.p,
        SVGFEDiffuseLightingElement: P.p,
        SVGFEDisplacementMapElement: P.p,
        SVGFEDistantLightElement: P.p,
        SVGFEFloodElement: P.p,
        SVGFEFuncAElement: P.p,
        SVGFEFuncBElement: P.p,
        SVGFEFuncGElement: P.p,
        SVGFEFuncRElement: P.p,
        SVGFEGaussianBlurElement: P.p,
        SVGFEImageElement: P.p,
        SVGFEMergeElement: P.p,
        SVGFEMergeNodeElement: P.p,
        SVGFEMorphologyElement: P.p,
        SVGFEOffsetElement: P.p,
        SVGFEPointLightElement: P.p,
        SVGFESpecularLightingElement: P.p,
        SVGFESpotLightElement: P.p,
        SVGFETileElement: P.p,
        SVGFETurbulenceElement: P.p,
        SVGFilterElement: P.p,
        SVGForeignObjectElement: P.p,
        SVGGElement: P.p,
        SVGGeometryElement: P.p,
        SVGGraphicsElement: P.p,
        SVGImageElement: P.p,
        SVGLineElement: P.p,
        SVGLinearGradientElement: P.p,
        SVGMarkerElement: P.p,
        SVGMaskElement: P.p,
        SVGMetadataElement: P.p,
        SVGPathElement: P.p,
        SVGPatternElement: P.p,
        SVGPolygonElement: P.p,
        SVGPolylineElement: P.p,
        SVGRadialGradientElement: P.p,
        SVGRectElement: P.p,
        SVGSetElement: P.p,
        SVGStopElement: P.p,
        SVGStyleElement: P.p,
        SVGSVGElement: P.p,
        SVGSwitchElement: P.p,
        SVGSymbolElement: P.p,
        SVGTSpanElement: P.p,
        SVGTextContentElement: P.p,
        SVGTextElement: P.p,
        SVGTextPathElement: P.p,
        SVGTextPositioningElement: P.p,
        SVGTitleElement: P.p,
        SVGUseElement: P.p,
        SVGViewElement: P.p,
        SVGGradientElement: P.p,
        SVGComponentTransferFunctionElement: P.p,
        SVGFEDropShadowElement: P.p,
        SVGMPathElement: P.p,
        SVGElement: P.p
    })
    hunkHelpers.setOrUpdateLeafTags({
        DOMError: true,
        DOMImplementation: true,
        MediaError: true,
        Navigator: true,
        NavigatorConcurrentHardware: true,
        NavigatorUserMediaError: true,
        OverconstrainedError: true,
        PositionError: true,
        GeolocationPositionError: true,
        Range: true,
        TextMetrics: true,
        SQLError: true,
        ArrayBuffer: true,
        DataView: true,
        ArrayBufferView: false,
        Float32Array: true,
        Float64Array: true,
        Int16Array: true,
        Int32Array: true,
        Int8Array: true,
        Uint16Array: true,
        Uint32Array: true,
        Uint8ClampedArray: true,
        CanvasPixelArray: true,
        Uint8Array: false,
        HTMLAudioElement: true,
        HTMLBRElement: true,
        HTMLButtonElement: true,
        HTMLContentElement: true,
        HTMLDListElement: true,
        HTMLDataElement: true,
        HTMLDataListElement: true,
        HTMLDetailsElement: true,
        HTMLDialogElement: true,
        HTMLEmbedElement: true,
        HTMLFieldSetElement: true,
        HTMLHRElement: true,
        HTMLHeadElement: true,
        HTMLHeadingElement: true,
        HTMLHtmlElement: true,
        HTMLIFrameElement: true,
        HTMLImageElement: true,
        HTMLInputElement: true,
        HTMLLIElement: true,
        HTMLLabelElement: true,
        HTMLLegendElement: true,
        HTMLLinkElement: true,
        HTMLMapElement: true,
        HTMLMediaElement: true,
        HTMLMenuElement: true,
        HTMLMetaElement: true,
        HTMLMeterElement: true,
        HTMLModElement: true,
        HTMLOListElement: true,
        HTMLObjectElement: true,
        HTMLOptGroupElement: true,
        HTMLOptionElement: true,
        HTMLOutputElement: true,
        HTMLParamElement: true,
        HTMLPictureElement: true,
        HTMLPreElement: true,
        HTMLProgressElement: true,
        HTMLQuoteElement: true,
        HTMLScriptElement: true,
        HTMLShadowElement: true,
        HTMLSlotElement: true,
        HTMLSourceElement: true,
        HTMLStyleElement: true,
        HTMLTableCaptionElement: true,
        HTMLTableColElement: true,
        HTMLTextAreaElement: true,
        HTMLTimeElement: true,
        HTMLTitleElement: true,
        HTMLTrackElement: true,
        HTMLUListElement: true,
        HTMLUnknownElement: true,
        HTMLVideoElement: true,
        HTMLDirectoryElement: true,
        HTMLFontElement: true,
        HTMLFrameElement: true,
        HTMLFrameSetElement: true,
        HTMLMarqueeElement: true,
        HTMLElement: false,
        HTMLAnchorElement: true,
        HTMLAreaElement: true,
        HTMLBaseElement: true,
        Blob: false,
        HTMLBodyElement: true,
        HTMLCanvasElement: true,
        CanvasRenderingContext2D: true,
        CDATASection: true,
        CharacterData: true,
        Comment: true,
        ProcessingInstruction: true,
        Text: true,
        CSSStyleDeclaration: true,
        MSStyleCSSProperties: true,
        CSS2Properties: true,
        CSSStyleSheet: true,
        HTMLDivElement: true,
        DOMException: true,
        DOMTokenList: true,
        Element: false,
        AbortPaymentEvent: true,
        AnimationEvent: true,
        AnimationPlaybackEvent: true,
        ApplicationCacheErrorEvent: true,
        BackgroundFetchClickEvent: true,
        BackgroundFetchEvent: true,
        BackgroundFetchFailEvent: true,
        BackgroundFetchedEvent: true,
        BeforeInstallPromptEvent: true,
        BeforeUnloadEvent: true,
        BlobEvent: true,
        CanMakePaymentEvent: true,
        ClipboardEvent: true,
        CloseEvent: true,
        CustomEvent: true,
        DeviceMotionEvent: true,
        DeviceOrientationEvent: true,
        ErrorEvent: true,
        ExtendableEvent: true,
        ExtendableMessageEvent: true,
        FetchEvent: true,
        FontFaceSetLoadEvent: true,
        ForeignFetchEvent: true,
        GamepadEvent: true,
        HashChangeEvent: true,
        InstallEvent: true,
        MediaEncryptedEvent: true,
        MediaKeyMessageEvent: true,
        MediaQueryListEvent: true,
        MediaStreamEvent: true,
        MediaStreamTrackEvent: true,
        MIDIConnectionEvent: true,
        MIDIMessageEvent: true,
        MutationEvent: true,
        NotificationEvent: true,
        PageTransitionEvent: true,
        PaymentRequestEvent: true,
        PaymentRequestUpdateEvent: true,
        PopStateEvent: true,
        PresentationConnectionAvailableEvent: true,
        PresentationConnectionCloseEvent: true,
        ProgressEvent: true,
        PromiseRejectionEvent: true,
        PushEvent: true,
        RTCDataChannelEvent: true,
        RTCDTMFToneChangeEvent: true,
        RTCPeerConnectionIceEvent: true,
        RTCTrackEvent: true,
        SecurityPolicyViolationEvent: true,
        SensorErrorEvent: true,
        SpeechRecognitionError: true,
        SpeechRecognitionEvent: true,
        SpeechSynthesisEvent: true,
        StorageEvent: true,
        SyncEvent: true,
        TrackEvent: true,
        TransitionEvent: true,
        WebKitTransitionEvent: true,
        VRDeviceEvent: true,
        VRDisplayEvent: true,
        VRSessionEvent: true,
        MojoInterfaceRequestEvent: true,
        ResourceProgressEvent: true,
        USBConnectionEvent: true,
        IDBVersionChangeEvent: true,
        AudioProcessingEvent: true,
        OfflineAudioCompletionEvent: true,
        WebGLContextEvent: true,
        Event: false,
        InputEvent: false,
        SubmitEvent: false,
        EventTarget: false,
        File: true,
        HTMLFormElement: true,
        ImageData: true,
        Location: true,
        MessageEvent: true,
        MessagePort: true,
        MouseEvent: true,
        DragEvent: true,
        PointerEvent: true,
        WheelEvent: true,
        Document: true,
        DocumentFragment: true,
        HTMLDocument: true,
        ShadowRoot: true,
        XMLDocument: true,
        DocumentType: true,
        Node: false,
        NodeList: true,
        RadioNodeList: true,
        HTMLParagraphElement: true,
        HTMLSelectElement: true,
        HTMLSpanElement: true,
        Storage: true,
        StyleSheet: false,
        HTMLTableCellElement: true,
        HTMLTableDataCellElement: true,
        HTMLTableHeaderCellElement: true,
        HTMLTableElement: true,
        HTMLTableRowElement: true,
        HTMLTableSectionElement: true,
        HTMLTemplateElement: true,
        CompositionEvent: true,
        FocusEvent: true,
        KeyboardEvent: true,
        TextEvent: true,
        TouchEvent: true,
        UIEvent: false,
        Window: true,
        DOMWindow: true,
        Attr: true,
        NamedNodeMap: true,
        MozNamedAttrMap: true,
        StyleSheetList: true,
        SVGScriptElement: true,
        SVGAElement: true,
        SVGAnimateElement: true,
        SVGAnimateMotionElement: true,
        SVGAnimateTransformElement: true,
        SVGAnimationElement: true,
        SVGCircleElement: true,
        SVGClipPathElement: true,
        SVGDefsElement: true,
        SVGDescElement: true,
        SVGDiscardElement: true,
        SVGEllipseElement: true,
        SVGFEBlendElement: true,
        SVGFEColorMatrixElement: true,
        SVGFEComponentTransferElement: true,
        SVGFECompositeElement: true,
        SVGFEConvolveMatrixElement: true,
        SVGFEDiffuseLightingElement: true,
        SVGFEDisplacementMapElement: true,
        SVGFEDistantLightElement: true,
        SVGFEFloodElement: true,
        SVGFEFuncAElement: true,
        SVGFEFuncBElement: true,
        SVGFEFuncGElement: true,
        SVGFEFuncRElement: true,
        SVGFEGaussianBlurElement: true,
        SVGFEImageElement: true,
        SVGFEMergeElement: true,
        SVGFEMergeNodeElement: true,
        SVGFEMorphologyElement: true,
        SVGFEOffsetElement: true,
        SVGFEPointLightElement: true,
        SVGFESpecularLightingElement: true,
        SVGFESpotLightElement: true,
        SVGFETileElement: true,
        SVGFETurbulenceElement: true,
        SVGFilterElement: true,
        SVGForeignObjectElement: true,
        SVGGElement: true,
        SVGGeometryElement: true,
        SVGGraphicsElement: true,
        SVGImageElement: true,
        SVGLineElement: true,
        SVGLinearGradientElement: true,
        SVGMarkerElement: true,
        SVGMaskElement: true,
        SVGMetadataElement: true,
        SVGPathElement: true,
        SVGPatternElement: true,
        SVGPolygonElement: true,
        SVGPolylineElement: true,
        SVGRadialGradientElement: true,
        SVGRectElement: true,
        SVGSetElement: true,
        SVGStopElement: true,
        SVGStyleElement: true,
        SVGSVGElement: true,
        SVGSwitchElement: true,
        SVGSymbolElement: true,
        SVGTSpanElement: true,
        SVGTextContentElement: true,
        SVGTextElement: true,
        SVGTextPathElement: true,
        SVGTextPositioningElement: true,
        SVGTitleElement: true,
        SVGUseElement: true,
        SVGViewElement: true,
        SVGGradientElement: true,
        SVGComponentTransferFunctionElement: true,
        SVGFEDropShadowElement: true,
        SVGMPathElement: true,
        SVGElement: false
    })
    H.NativeTypedArray.$nativeSuperclassTag = "ArrayBufferView"
    H._NativeTypedArrayOfDouble_NativeTypedArray_ListMixin.$nativeSuperclassTag = "ArrayBufferView"
    H._NativeTypedArrayOfDouble_NativeTypedArray_ListMixin_FixedLengthListMixin.$nativeSuperclassTag = "ArrayBufferView"
    H.NativeTypedArrayOfDouble.$nativeSuperclassTag = "ArrayBufferView"
    H._NativeTypedArrayOfInt_NativeTypedArray_ListMixin.$nativeSuperclassTag = "ArrayBufferView"
    H._NativeTypedArrayOfInt_NativeTypedArray_ListMixin_FixedLengthListMixin.$nativeSuperclassTag = "ArrayBufferView"
    H.NativeTypedArrayOfInt.$nativeSuperclassTag = "ArrayBufferView"
})()
Function.prototype.$2 = function (a, b) {
    return this(a, b)
}
Function.prototype.$1 = function (a) {
    return this(a)
}
Function.prototype.$0 = function () {
    return this()
}
Function.prototype.$3 = function (a, b, c) {
    return this(a, b, c)
}
Function.prototype.$4 = function (a, b, c, d) {
    return this(a, b, c, d)
}
Function.prototype.$1$1 = function (a) {
    return this(a)
}
Function.prototype.$5 = function (a, b, c, d, e) {
    return this(a, b, c, d, e)
}
Function.prototype.$7 = function (a, b, c, d, e, f, g) {
    return this(a, b, c, d, e, f, g)
}
Function.prototype.$6 = function (a, b, c, d, e, f) {
    return this(a, b, c, d, e, f)
};

function main() {
    var async_goto = 0,
        async_completer = P._makeAsyncAwaitCompleter(t.z),
        q, switch_to = 2,
        async_result_1, n = [],
        m, l, k, j, raw_names, h, profiler, f, e, d, c, b, a, a0_getter, a1, a2, a3, a4, a5, a6, a7, team_1, team_2, b0
    var $async$iE = P._wrapJsFunctionForAsync(function (error_code, async_result) {
        if (error_code === 1) {
            async_result_1 = async_result
            async_goto = switch_to
        }
        while (true) switch (async_goto) {
            case 0:
                team_1 = LangData.oC(true).c
                team_2 = team_1[$.B()]
                $.mb = team_2
                $.ta = team_2 + $.d_()
                $.nV = team_1[$.C()]
                $.nW = team_1[$.X()]
                $.tb = team_1[$.a4()]

                if (run_env.from_code) {
                    console.log("initing from node")
                    $.ox = assets_data.gAd
                } else {
                    // a2 = window.localStorage.getItem(LanData.j("T|a`4tFX30f3:o_Vx]na4ki/|ye&j=D", 15))
                    a2 = window.localStorage.getItem("go​ogle_experiment_mod1")
                    // console.log("a2", a2)
                    if (a2 != null) {
                        $.ox = new H.a9(H.b(a2.split(""), t.s), t.bJ).f3(0)
                    }
                }

                async_goto = 3
                return P._asyncAwait(HtmlRenderer.static_init(), $async$iE)
            case 3:
                // MARK: 名字输入位置
                // 战斗框输入位置
                // 这里请输入一个被混淆过的名字
                switch_to = 5

                if (run_env.from_code) {
                    raw_names = name_input
                    console.log("node input:|\n", raw_names, "\n|")
                } else {

                    m = window.sessionStorage.getItem(LangData.eQ("k"))
                    l = X.f4(m, 0)
                    k = LangData.oC(false)
                    let type_tmp = t.i
                    j = H.b([], type_tmp)
                    J.rr(j, H.b([1, 3, 0, 9], type_tmp))
                    k.bO(j)
                    k.di(l)
                    raw_names = C.e.bt(0, l)
                }

                // 或者直接在这里输入一个原始字符串
                h = T.parse_names(raw_names)

                // if (J.Y(J.J(J.J(h, 0)[0], 0), $.qc())) {
                if ($.qc() === h[0][0][0]) {
                    logger.debug("进入测号 init")
                    $.vr = 6
                    // if (J.aw(h) === 2)
                    if (h.length === 2) {
                        // if (J.J(h, 1).length > 10 || J.lW(J.J(J.J(h, 1)[0], 0), O.j("S,AF", 5))) {
                        // LangData.j("S,AF", 5) -> ???
                        if (h[1].length > 10 || J.lW(h[1][0][0], LangData.j("S,AF", 5))) {
                            logger.info("官方搜号")
                            team_1 = h[1]
                            team_2 = H.b([], t.t)

                            profiler = new X.ProfileFind(team_2, new Float64Array(1))
                            d.e_(team_1)

                            f = HtmlRenderer.outer_main(profiler)

                            f.r = 2000
                            async_goto = 1
                            break
                        } else {
                            logger.info("官方测号-评分")

                            e = $.nk()
                            // if (J.J(h, 0).length === 2 && J.Y(J.J(J.J(h, 0)[1], 0), $.cl())) {
                            if (h[0].length === 2 && h[0][1][0] === $.cl()) {
                                team_1 = h[1]
                                e = $.cl()
                            }
                            team_1 = h[1]
                            team_2 = e
                            a3 = H.b([], t.L)
                            a4 = H.b([], t.V)
                            a5 = H.b([], t.M)

                            profiler = new V.ProfileMain(team_2, team_1, a3, a4, a5, P.cu(t.X, t.B), new Float64Array(1))
                            profiler.dZ(team_1, team_2)
                            profiler.d = 1000

                            c = HtmlRenderer.outer_main(profiler)

                            c.r = 2000
                            async_goto = 1
                            break
                        }
                    } else if (h.length === 3) {
                        logger.info("官方测号-胜率")

                        team_1 = h[1]
                        team_2 = h[2]
                        a3 = t.L
                        a4 = H.b([], a3)
                        a3 = H.b([], a3)
                        a5 = H.b([], t.V)
                        a6 = H.b([], t.M)

                        profiler = new L.ProfileWinChance(team_1, team_2, a4, a3, a5, a6, new Float64Array(1))
                        profiler.dY(team_1, team_2)
                        profiler.c = 1000

                        a = HtmlRenderer.outer_main(profiler)

                        a.r = 2000
                        async_goto = 1
                        break
                    }
                }
                async_goto = 8
                // c2 似乎是起始
                return P._asyncAwait(T.inner_main(h), $async$iE)
            case 8:
                // a0_getter = async_result
                // HtmlRenderer.jt(a0_getter)
                logger.debug("main case 8")
                HtmlRenderer.outer_main(async_result)
                switch_to = 2
                async_goto = 7
                break
            case 5:
                switch_to = 4
                b0 = async_result_1
                a1 = H.unwrap_Exception(b0)
                H.getTraceFromException(b0)
                async_goto = 7
                break
            case 4:
                async_goto = 2
                break
            case 7:
                logger.debug("so just here?", async_goto, error_code)
            case 1:
                logger.debug("返回中")
                return P.async_return(q, async_completer)
            case 2:
                return P.async_rethrow(async_result_1, async_completer)
        }
    })
    return P._asyncStartSync($async$iE, async_completer)
}

logger.debug("反混淆", LangData.j("6ct2H)A", 11))
main();
// logger.debug("running main:", main()) // 执行main函数
