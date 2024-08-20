import {exec} from "node:child_process";
import {promisify} from "node:util";
import AdmZip from "adm-zip"
import fs from "fs";

const execPromise = promisify(exec);

async function run() {
    try {
        console.log("Saving to file..")
        let zip = new AdmZip();
        const excludes = fs.readFileSync(".dockerignore", {encoding: "utf-8"})
            .split("\n")
            .map((line) => line.trim())
        excludes.push("dist")

        fs.readdirSync("./")
            .filter((file) => !excludes.includes(file))
            .forEach((file) => {
                if (fs.statSync(file).isFile()) {
                    zip.addLocalFile(file)
                } else {
                    zip.addLocalFolder(file, file+"/")
                }
            })
        await zip.writeZipPromise("dist/firmware.zip")
        console.log("Save done!")
    } catch (e) {
        console.error("Error when building:", e)
    }
}

run()
