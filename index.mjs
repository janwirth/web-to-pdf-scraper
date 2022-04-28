

// scrape different websites
// NEXT FEATURES
// - OK to PDF using markdown-it
// - OK download images
// - fix SSR not working
// - clean up PDF (icons)

import fetch from "node-fetch"
import {JSDOM} from 'jsdom';
import turndown_ from 'turndown'
import slugify from "slugify"
const turndown = new turndown_()


import fs from 'fs'

const pagesToScrape_ = [
    {
    homeUrl: "https://lawsofux.com/",
    mainSelector: "main",
    otherPagesAnchorSelector: ".card__title a"
} , { homeUrl: "https://designing-design-tools.nolwennmaudet.com/"
    , mainSelector: "#wrap-content"
    , otherPagesAnchorSelector: "dontselect"
    }, { homeUrl: "https://humanebydesign.com/",
        otherPagesAnchorSelector: "card__link",
        mainSelector: "main"
    },
]
const pagesToScrape = [
    { homeUrl: "https://builtformars.com/",
        otherPagesAnchorSelector: "a.summary__image",
        mainSelector: "main"
    }
]


function main () {
    pagesToScrape.forEach(p => {
        convertOnePageToPdf(p)
    })
}
const DEBUG = true

const getOneMainElement = mainSelector => async url => {
    console.log('fetching', url)
    const html = await (await fetch(url)).text()
    const window = new JSDOM(html).window
    const document = window.document
    const main = document.querySelector(mainSelector)
    return main
}

const getAssets = mainElement => Array.from(mainElement.querySelectorAll("[src]")).map(el => el.src)

const scrapeOnePage = async ({homeUrl, mainSelector, otherPagesAnchorSelector}) => {
    const homeMainElement = await getOneMainElement(mainSelector)(homeUrl)
    const subContentRequests =
        Array.from(homeMainElement.querySelectorAll(otherPagesAnchorSelector))
            // .slice(DEBUG ? -1 : 0)
            .map(a => homeUrl + a.href)
            .map(getOneMainElement(mainSelector))
    const otherPagesMainElements = await Promise.all(subContentRequests)
    const assets =
        [getAssets(homeMainElement), ...otherPagesMainElements.map(getAssets)]
        .flatMap(_ => _)
    const fetchedAssets =
        await Promise.all(assets
            .slice(DEBUG ? -1 : 0)
            .map(async url => {
                try {
                    const fetchResult = await fetch(homeUrl + url)
                    return [url
                            , await fetchResult.buffer()
                            ]
                } catch (e) {
                    console.log('could not fetch', url)
                    return false
                }
            })
            .filter(_ => _)
        )
    return { homeContent : homeMainElement.innerHTML
        , fetchedAssets
        , otherPagesContent : otherPagesMainElements.map(el => el.innerHTML).join("")
        }
}

const convertOnePageToPdf = async pageConfig => {
    const {homeContent, otherPagesContent, fetchedAssets} = await scrapeOnePage(pageConfig)
    const mdContent = turndown.turndown(homeContent + "<br/>" + otherPagesContent)

    const name = slugify(pageConfig.homeUrl.split("://")[1])

    await Promise.all(
        fetchedAssets.map(async ([assetName, buffer]) => {
            ensureDirectoryExistence(`./out/${assetName}`)
            await fs.promises.writeFile(`./out/${assetName}`, buffer)
        }
        )
    )
    try {
        await fs.promises.rm('./out')
    } catch (e) {
    }
    try {
        await fs.promises.mkdir('./out')
    } catch (e) {
    }
    await fs.promises.writeFile(`./out/${name}.md`, mdContent, 'utf8')
    console.log("MAKING PDF", name)
    await fs.promises.writeFile(`./out/${name}.pdf`, await toPDF(`./out/${name}.md`), 'utf8')
    console.log("MADE PDF", name)
    // await fs.promises.writeFile(`${name}.pdf`, (toPDF), 'utf8')
    // const pdf = throw "to implement"
}

import path from "path"
function ensureDirectoryExistence(filePath) {
  var dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

// MARKDOWN TO PDF
import { mdToPdf } from 'md-to-pdf'

const toPDF = async path => {
	const pdf = await mdToPdf({ path }).catch(console.error);
	return pdf.content
}
main()
