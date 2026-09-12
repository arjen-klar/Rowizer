import { ZermeloApi } from "./zermelo/zermelo.js";
import { Dagrooster } from "./controllers/dagrooster/dagrooster.js";
import ZermeloConnector from "./connectors/zermeloConnector.js";
import { KlassenroosterUiManager } from "./views/klassenrooster/klassenroosterUiManager.js";

let params = new URLSearchParams(window.location.search);

var zapi = new ZermeloApi({
    portal: params.get("portal"),
    token: params.get("token"),
    branch: params.get("branch")
});

$(document).ready(function () {
    let param_date = params.get("date");
    let param_branch = params.get("branch");
    let param_ignore = params.get("departmentsIgnore");
    let param_classes = params.get("classes"); // Comma-separated list of class codes (e.g., "mm.mm1a,mm.mm1b")

    let connector = new ZermeloConnector(
        zapi, 
        param_date ? param_date : undefined, 
        {
            branch: param_branch ? param_branch : undefined, 
            ignore_departments: param_ignore ? param_ignore.split(",") : []
        }
    );

    let dagroosterManager = new Dagrooster(connector);
    let klassenroosterUiManager = new KlassenroosterUiManager(
        document.querySelector("#content-container"), 
        connector, 
        dagroosterManager,
        param_classes ? param_classes.split(",").map(c => c.trim()) : null
    );

    // Set up header with date and time
    $("#title").text("Klassenrooster");

    // Update clock
    function showTime(){
        var date = new Date();
        var h = date.getHours();
        var m = date.getMinutes();
        var s = date.getSeconds();

        h = (h < 10) ? "0" + h : h;
        m = (m < 10) ? "0" + m : m;
        s = (s < 10) ? "0" + s : s;

        let time = h + ":" + m + ":" + s;
        document.getElementById("clock").innerText = time;
        document.getElementById("clock").textContent = time;

        setTimeout(showTime, 1000);
    }

    showTime();

    // Initialize klassenrooster
    connector.waitUntilReady().then(() => {
        dagroosterManager.loadData().then(() => {
            klassenroosterUiManager.init();

            // Refresh data every 5 minutes
            setInterval(() => {
                dagroosterManager.refresh().then(() => {
                    klassenroosterUiManager.render();
                });
            }, 5 * 60 * 1000);
        });
    }).catch(error => {
        console.error("Failed to initialize klassenrooster:", error);
        document.querySelector("#content-container").innerHTML = 
            "<p>Error loading schedule data. Please check your credentials.</p>";
    });
});
