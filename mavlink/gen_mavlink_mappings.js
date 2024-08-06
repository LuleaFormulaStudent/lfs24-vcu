var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { generateAll } from "node-mavlink";
import fs from "fs";
import path from "path";
function generateFile(filename, moduleName) {
    return __awaiter(this, void 0, void 0, function* () {
        const lines = [
            "import {MavLinkData} from \"mavlink-mappings\"\n" +
                "import {MavLinkPacketField} from \"mavlink-mappings/dist/lib/mavlink\"\n" +
                "import {uint8_t, float, MavLinkPacketRegistry} from \"node-mavlink\""
        ];
        const source = fs.readFileSync(filename, { encoding: "utf-8" });
        const output = { write: msg => lines.push(msg !== null && msg !== void 0 ? msg : '') };
        const { enums, commands, messages } = yield generateAll(source, output, moduleName);
        return { code: lines.join('\n'), enums, commands, messages };
    });
}
function generateFiles(filenames, output_path) {
    return __awaiter(this, void 0, void 0, function* () {
        const magicNumbers = {};
        function updateMagicNumbersWithNewMessages(messages) {
            messages.forEach(message => {
                if (message.magic !== undefined) {
                    magicNumbers[message.id] = message.magic;
                }
            });
        }
        for (const filename of filenames) {
            const moduleName = path.parse(filename).name;
            const { code, messages } = yield generateFile(filename, moduleName);
            updateMagicNumbersWithNewMessages(messages);
            const outputFileName = path.basename(filename).replace(".xml", ".ts");
            fs.writeFileSync(path.join(output_path, outputFileName), code);
        }
    });
}
generateFiles(fs.readdirSync("mavlink")
    .filter((file) => file.endsWith(".xml"))
    .map((file) => path.join("mavlink", file)), "src/libs/mavlink");
