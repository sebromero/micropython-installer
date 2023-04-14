const installButton = document.getElementById('install-button');
const chooseFileLink = document.getElementById('choose-file-link');
const outputElement = document.getElementById('output');
const fileDropElement = document.getElementById('file-drop-area');
const flashActivityIndicator = document.getElementById('activity-indicator');
const useNightlyBuildCheckbox = document.getElementById('nightly-builds-enabled');
const deviceLoadingActivityIndicator = document.getElementById("device-loading-indicator");
const reloadLinkContainer = document.getElementById("reload-link-container");
const deviceSelectionList = document.querySelector(".item-selection-list");
const reloadDeviceListLink = document.getElementById("reload-link");

const flashFirmwareFromFile = (filePath) => {
    disableFlashingInteractions();
    disableDeviceListInteractions();
    showLoadingIndicator();

    const data = {
      deviceData : getSelectedDeviceData(deviceSelectionList),
      filePath : filePath
    };

    window.api.invoke('on-file-selected', data).then(function (result) {
        console.log(result);
        showStatusText(result, outputElement, 5000);
        // Give the device some time to reboot
        refreshDeviceList(2000);
    }).catch(function (err) {
        console.error(err);
        setTimeout(() => {
            showStatusText("❌ Failed to flash firmware.", outputElement, 5000);
        }, 4000);
    }).finally(() => {
        enableFlashingInteractions();
        enableDeviceListInteractions();
        hideLoadingIndicator();
    });
};

let animationRunning = false;
let fadeOutTimeout = null;

function showStatusText(text, target, duration = null, speed = 50) {
  const statusText = target;

  if (animationRunning) {
    statusText.textContent = text;
    clearTimeout(fadeOutTimeout);
    if(duration){
        fadeOutTimeout = setTimeout(() => {
          const fadeOutInterval = setInterval(() => {
            let opacity = parseFloat(statusText.style.opacity);
            opacity -= 0.1;
            statusText.style.opacity = opacity;
            if (opacity <= 0) {
              clearInterval(fadeOutInterval);
              statusText.style.visibility = 'hidden';
              animationRunning = false;
            }
          }, speed);
        }, duration);
    }
    return;
  }
  animationRunning = true;
  statusText.textContent = text;
  statusText.style.opacity = 0;
  statusText.style.visibility = 'visible';

  let opacity = 0;
  const fadeInInterval = setInterval(() => {
    opacity += 0.1;
    statusText.style.opacity = opacity;
    if (opacity >= 1) {
      clearInterval(fadeInInterval);
      if (duration) {
        fadeOutTimeout = setTimeout(() => {
          const fadeOutInterval = setInterval(() => {
            let opacity = parseFloat(statusText.style.opacity);
            opacity -= 0.1;
            statusText.style.opacity = opacity;
            if (opacity <= 0) {
              clearInterval(fadeOutInterval);
              statusText.style.visibility = 'hidden';
              animationRunning = false;
            }
          }, speed);
        }, duration);
      } else {
        animationRunning = false;
      }
    }
  }, speed);
}


function disableDeviceListInteractions() {
  reloadDeviceListLink.style.pointerEvents = 'none';
  reloadDeviceListLink.style.opacity = 0.25;

  // Disable all buttons in the device selection list
  const deviceItems = deviceSelectionList.querySelectorAll(".selection-item");
  deviceItems.forEach((item) => {
    item.disabled = true;
  });
}

function enableDeviceListInteractions() {
  reloadDeviceListLink.style.pointerEvents = 'auto';
  reloadDeviceListLink.style.opacity = 1;

   // Enable all buttons in the device selection list
   const deviceItems = deviceSelectionList.querySelectorAll(".selection-item");
   deviceItems.forEach((item) => {
       item.disabled = false;
   });
}

function enableFlashingInteractions() {
    installButton.disabled = false;
    installButton.style.opacity = 1;
    fileDropElement.style.opacity = 1;
    fileDropElement.style.pointerEvents = 'auto';
}

function disableFlashingInteractions() {
    installButton.disabled = true;
    installButton.style.opacity = 0.25;
    fileDropElement.style.opacity = 0.25;
    fileDropElement.style.pointerEvents = 'none';
}
  
function showLoadingIndicator() {
  flashActivityIndicator.style.display = 'inline-block';
}

function hideLoadingIndicator() {
  flashActivityIndicator.style.display = 'none';
}

window.api.on('on-output', (message) => {
    showStatusText(message, outputElement);
});

reloadDeviceListLink.addEventListener('click', () => {
    disableFlashingInteractions();
    refreshDeviceList();
});

chooseFileLink.addEventListener('click', () => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");    
    input.onchange = async (event) => {
        // Get the selected file from the input element
        const file = event.target.files[0];
        flashFirmwareFromFile(file.path);
    };
    input.click();
    return false;
});
      

installButton.addEventListener('click', () => {
    disableFlashingInteractions();
    disableDeviceListInteractions();
    showLoadingIndicator();
    const data = {
      deviceData : getSelectedDeviceData(deviceSelectionList),
      useNightlyBuild : useNightlyBuildCheckbox.checked
    };

    window.api.invoke('on-install', data)
        .then((result) => {
            console.log(result);
            showStatusText(result, outputElement, 5000);
            // Give the device some time to reboot
            refreshDeviceList(2000);
        })
        .catch((err) => {
            console.error(err);
            setTimeout(() => {
                showStatusText("❌ Failed to flash firmware.", outputElement, 5000);
            }, 4000);
        }).finally(() => {
            enableFlashingInteractions();
            enableDeviceListInteractions();
            hideLoadingIndicator();
        });
});

fileDropElement.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileDropElement.classList.add('file-drop-hovered');
});

fileDropElement.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileDropElement.classList.remove('file-drop-hovered');
});

fileDropElement.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    fileDropElement.classList.remove('file-drop-hovered');

    let filePaths = [];
    for (const f of event.dataTransfer.files) {
        // Using the path attribute to get absolute file path
        filePaths.push(f.path);
    }

    if(filePaths.length > 1) {
        event.preventDefault();
        event.stopPropagation();
        return;
    }

    flashFirmwareFromFile(filePaths[0]);
});


function selectDevice(deviceItem) {
  const container = deviceItem.parentElement;
  const previousSelectedElement = container.querySelector(".selected");

  if (previousSelectedElement !== null) {
      previousSelectedElement.classList.remove("selected");
  }

  deviceItem.classList.add("selected");
  deviceItem.dispatchEvent(new Event("device-selected", { bubbles: true }));
}

function getSelectedDeviceData(container) {
  const selectedElement = container.querySelector(".selected");
  
  if(!selectedElement) {
    return null;
  }

  return {
    vendorID: parseInt(selectedElement.dataset.vid),
    productID: parseInt(selectedElement.dataset.pid)
  };
}

function createDeviceSelectorItem(device) {
  const fullDeviceName = device.manufacturer + " " + device.name;
  const deviceItem = document.createElement("button");
  deviceItem.classList.add("selection-item");

  // Populate the device item with data attributes so that we can easily access them later
  // when the user selects a device and we need to flash the firmware
  deviceItem.setAttribute("data-vid", device.vendorID);
  deviceItem.setAttribute("data-pid", device.productID);
  deviceItem.addEventListener("click", () => {
    selectDevice(deviceItem);    
  });

  const deviceImage = document.createElement("img");
  deviceImage.setAttribute("src", "./assets/boards/" + fullDeviceName + ".svg");
  deviceItem.appendChild(deviceImage);

  const deviceLabel = document.createElement("span");
  deviceLabel.classList.add("selection-item-label");
  deviceLabel.textContent = fullDeviceName;
  deviceItem.appendChild(deviceLabel);

  return deviceItem;
}

function refreshDeviceList(delay = 0) {
  // Clear the device list
  displayDevices([], deviceSelectionList);

  if(delay > 0) {
    // Calls itself after a delay while passing 0 as the delay.
    setTimeout(refreshDeviceList, delay);
    return;
  }

  deviceLoadingActivityIndicator.style.display = 'block';

  window.api.invoke('on-get-devices').then((result) => {
    displayDevices(result, deviceSelectionList);
    deviceLoadingActivityIndicator.style.display = 'none';
  }).catch((err) => {
    console.error(err);
    // Try again in 4 seconds
    setTimeout(refreshDeviceList, 4000);
  });
}

function displayDevices(deviceList, container) {
  
  // Sort the device list by manufacturer name and device name
  deviceList.sort((deviceA, deviceB) => {
    const deviceAName = deviceA.manufacturer + deviceA.name;
    const deviceBName = deviceB.manufacturer + deviceB.name;
    return deviceAName.localeCompare(deviceBName);
  });

  // Clear the device list
  container.innerHTML = "";

  reloadLinkContainer.style.display = deviceList.length > 0 ? 'block' : 'none';

  for (const device of deviceList) {
    container.appendChild(createDeviceSelectorItem(device));
  }
    

  // If there is only one device, select it
  if(deviceList.length == 1) {
    selectDevice(container.firstElementChild);
  }

}

window.addEventListener('DOMContentLoaded', () => {
  disableFlashingInteractions();
  
  deviceSelectionList.addEventListener("device-selected", (event) => {
    enableFlashingInteractions();
  });

  refreshDeviceList();
});
