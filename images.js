const { Builder, By, Key, until } = require('selenium-webdriver');
const fs = require('fs');
// const {} = require('lodash');
require('colors');
const yaml = require('js-yaml');
const download = require('image-downloader');


function makeDir(folderPath) {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
}

function jsonFileWrite(data, path, pretty = false) {
    const folderPath = path.substring(0, path.lastIndexOf('/'));
    try {
        makeDir(folderPath);
        if(pretty) {
            fs.writeFileSync(path, JSON.stringify(data, null, '\t'));
        } 
        else {
            fs.writeFileSync(path, JSON.stringify(data));
        }
    }
    catch (e) {
        console.log(e);
    }
}

function jsonFileRead(path) {
    try {
        if (fs.existsSync(path)) {
            let jsonFile = fs.readFileSync(path, 'utf8');
            return JSON.parse(jsonFile);
        } else {
            // console.log(`Could not find ${path}`.red);
            return null;
        }

    } catch (e) {
        console.log(e);
        return null;
    }
}

function readYaml(path) {
    try {
        let file = fs.readFileSync(path, 'utf8');
        return yaml.load(file);

    } catch (e) {
        console.log(e);
        return null;
    }
}

async function imgDownloader(cat, links, {dataPath, downloadTimeout}) {

    console.log(`Downloading images for section `.cyan + `${cat}`.yellow + `...`.cyan);

    let downloadedImgCount = 0;
    let duplicatesCount = 0;
    const imgIds = jsonFileRead(`${dataPath}data/images/${cat}/imgIds.json`) ?? [];

    for(let link of links) {
        linkSplit = link.split('/');
        const imgId = linkSplit[linkSplit.length-1].split('.')[0];
        if(imgIds.includes(imgId)) {
            duplicatesCount++;
            continue;
        }
        imgIds.push(imgId);
        
        const options = {
            url: link,
            dest: `${dataPath}data/images/${cat}/${imgId}.jpg`,
            timeout: downloadTimeout
        };

        await download.image(options)
            .then(() => {
                downloadedImgCount++;
            })
            .catch((err) => console.error(err.red));
    }

    jsonFileWrite(imgIds, `${dataPath}data/images/${cat}/imgIds.json`);

    console.log(`Downloaded `.cyan + `${downloadedImgCount}`.green + ` images in category `.cyan +  `${cat}`.yellow);
    if (duplicatesCount>0) {
        console.log(`Found and ignored `.cyan + `${duplicatesCount}`.yellow + ` duplicates`.cyan);
    }
    console.log("");
}

async function start() {
    const settings = readYaml('settings.yaml') ?? {
        maxCatPages: 3,
        dataPath: "",
        downloadTimeout: 100000,
        pageLoadTimeout: 10000
    }
    console.log(`Settings: `.yellow);
    console.log(settings);
    console.log('------------------------'.yellow);

    let driver;
    try {
        driver = await new Builder().forBrowser('chrome').build();
    } catch (e) {
        console.log(e);
    }

    const memeCategories = jsonFileRead(`${settings.dataPath}data/memecategories.json`);
    const memeCategoriesMap = jsonFileRead(`${settings.dataPath}data/memecategoriesmap.json`);
    catCounter = 1;
    for (memeCat of memeCategories) {
        console.log(`${catCounter}/${memeCategories.length} `.green + `${memeCat}`.brightGreen);
        const catLink = memeCategoriesMap[memeCat];
        const links = []
        for (let page=1; page<=settings.maxCatPages; page++) {
            try {
                driver.get(catLink + `?page=${page}`);

                // wait for body to load
                await driver.wait(until.elementLocated(By.css('body')), settings.pageLoadTimeout);
                // wait for content to load
                // await driver.wait(until.elementLocated(By.className('pager')), settings.pageLoadTimeout);

                let webElements = await driver.findElements(By.className('base-img'));

                if(webElements.length == 0) {
                    if(page>1) {
                        break;
                    }
                    console.log(`Did not find any elements in `.red + `${memeCat}`.yellow);
                    break;
                }

                for(el of webElements) {
                    let src = await el.getAttribute('src');
                    if (src == null) {
                        src = `https:${await el.getAttribute('data-src')}`;
                    }
                    links.push(src);
                }
            } catch (e) {
                console.log(e);
                return null;
            }
        }
        makeDir(`${settings.dataPath}data/images/${memeCat}/`)
        imgDownloader(memeCat, links, settings);
        catCounter++;
    }

    driver.close();

}
start();
