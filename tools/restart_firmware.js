import Dockerode from "dockerode"
import DockerodeCompose from "dockerode-compose"

var docker = new Dockerode();
var compose = new DockerodeCompose(docker, './docker-compose.yml', 'lfs-vcu');

(async () => {
    //await compose.up();
    var state = await compose.up();
    console.log(state);
})();