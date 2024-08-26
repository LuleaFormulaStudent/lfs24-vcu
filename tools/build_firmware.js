import {exec} from "node:child_process";
import {promisify} from "node:util";
import AdmZip from "adm-zip"
import fs from "fs";

const execPromise = promisify(exec);

async function run() {
    try {
        console.log("Saving to file..")
        let zip = new AdmZip();

        if (fs.existsSync("./build")) {
            fs.rmSync("./build", { recursive: true, force: true })
        }
        fs.mkdirSync("./build")

        fs.cpSync("./package.json", "./build/package.json")

        await execPromise("cd ./build/ && npm install --cpu=arm64 --os=linux")
        zip.addLocalFolder("./build/node_modules", "node_modules")
        zip.addLocalFile("./build/package-lock.json", "package-lock.json")
        const excludes = fs.readFileSync(".dockerignore", {encoding: "utf-8"})
            .split("\n")
            .map((line) => line.trim())
        excludes.push("dist")
        excludes.push("build")
        excludes.push("tools")

        fs.readdirSync("./")
            .filter((file) => !excludes.includes(file))
            .forEach((file) => {
                if (fs.statSync(file).isFile()) {
                    zip.addLocalFile(file)
                } else {
                    zip.addLocalFolder(file, file+"/")
                }
            })
        await zip.writeZipPromise("firmware.zip")
        console.log("Save done!")
    } catch (e) {
        console.error("Error when building:", e)
    }
}

run()
