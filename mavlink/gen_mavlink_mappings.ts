import {generateAll, Writer} from "node-mavlink";
import fs from "fs"
import path from "path";

async function generateFile(filename: string, moduleName: string) {
    const lines: string[] = [
        "import {MavLinkData} from \"mavlink-mappings\"\n" +
        "import {MavLinkPacketField} from \"mavlink-mappings/dist/lib/mavlink.js\"\n" +
        "import {uint8_t, float, MavLinkPacketRegistry} from \"node-mavlink\""
    ]
    const source = fs.readFileSync(filename, {encoding: "utf-8"})
    const output = {write: msg => lines.push(msg ?? '')} as Writer
    const {enums, commands, messages} = await generateAll(source, output, moduleName)

    return {code: lines.join('\n'), enums, commands, messages}
}

async function generateFiles(filenames: string[], output_path: string) {
    const magicNumbers: Record<string, number> = {}

    function updateMagicNumbersWithNewMessages(messages: { id: string, magic?: number }[]) {
        messages.forEach(message => {
            if (message.magic !== undefined) {
                magicNumbers[message.id] = message.magic
            }
        })
    }

    for (const filename of filenames) {
        const moduleName = path.parse(filename).name
        const {code, messages} = await generateFile(filename, moduleName)
        updateMagicNumbersWithNewMessages(messages)

        const outputFileName = path.basename(filename).replace(".xml", ".ts")
        fs.writeFileSync(path.join(output_path, outputFileName), code)
    }
}

console.log("[MAVLINK GENERATOR] Starting generate reference files.")
generateFiles(fs.readdirSync("mavlink")
    .filter((file) => file.endsWith(".xml"))
    .map((file) => path.join("mavlink", file)), "mavlink")
    .then(() => console.log("[MAVLINK GENERATOR] Done generating reference files!"))