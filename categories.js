const { Builder, By, Key, until } = require('selenium-webdriver');
const fs = require('fs');
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

function readYaml(path) {
    try {
        let file = fs.readFileSync(path, 'utf8');
        return yaml.load(file);

    } catch (e) {
        console.log(e);
        return null;
    }
}

async function imgDownloader(link, cat, {dataPath, downloadTimeout}) {

    const templateDir = `${dataPath}data/templates/${cat}`;
    makeDir(`${templateDir}/`);
        
    const options = {
        url: link,
        dest: `${templateDir}/${cat}.jpg`,
        timeout: downloadTimeout
    };

    await download.image(options).catch((err) => console.error(err));
}

async function start() {
    const settings = readYaml('settings.yaml') ?? {
        dataPath: ""
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

    const memeCategories = [];
    const tempMemeCategoriesMap = {};
    let page = 1;
    while (true) {
        try {
            driver.get('https://imgflip.com/memetemplates?page=' + page);

            await driver.wait(until.elementLocated(By.css('body')), 10000);
        
            let webElements = await driver.findElements(By.className('mt-title'));

            if(webElements.length == 0) {
                break;
            }

            for(el of webElements) {
                const memeCat = await el.getText()
                const normMemeCat = memeCat.replace(/[^a-zA-Z0-9- ]+/g, '').replace(/[ ]+/g, '-');
                const link = await el.findElement(By.css('a')).getAttribute('href');

                tempMemeCategoriesMap[normMemeCat] = link;
            }
        }
        catch (e) {

            console.log(e);
            return null;
        }
        page++;
    }

    // constructing an array without gifs
    for (let memeCat in tempMemeCategoriesMap) {
        const link = tempMemeCategoriesMap[memeCat];

        driver.get(link);
        // wait for body to load
        await driver.wait(until.elementLocated(By.css('body')), 10000);

        let webElements = await driver.findElements(By.className('meme-link'));

        if(webElements.length == 0) {
            console.log(`Did not find any elements in `.red + `${memeCat}`.yellow + `, category will be ignored`.red);
            continue;
        }

        let mtemplate;
        for(const el of webElements) {
            if(await el.getText() == 'Blank') {
                mtemplate = el;
                break;
            }
        }

        if(!mtemplate) continue;
        const img = await mtemplate.findElement(By.css('img'));
        if(!img) continue; 
        const src = await img.getAttribute('src');
    
        // lines 123 and 125 make this obselete, but lets keep it
        if(src.split('.').pop() != 'jpg' && src.split('.').pop() && 'jpeg' && src.split('.').pop() && 'png') {
            continue;
        }

        await imgDownloader(src, memeCat, settings);

        memeCategories.push(memeCat);
    }

    // reduce memeCategoriesMap
    const memeCategoriesMap = {}
    for(let memeCat of memeCategories){
        memeCategoriesMap[memeCat] = tempMemeCategoriesMap[memeCat];
    }

    jsonFileWrite(memeCategories, `${settings.dataPath}data/memecategories.json`, true);
    jsonFileWrite(memeCategoriesMap,`${settings.dataPath}data/memecategoriesmap.json`, true)

    console.log(`Fetched categories from ${page} pages`.yellow);
    console.log(`Collected a total of ${memeCategories.length} categories`.yellow);


    driver.close();

}
start();
