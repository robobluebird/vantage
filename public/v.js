let mediaType = 0;
let printedOnce = false;
let didMoveLastFrame = false;
let canControl = false;

const canvas = document.getElementById("canvas");
const points = [];
const interactableTemplates = [
  {
    name: 'link',
    image: new Image()
  },
  {
    name: 'text',
    image: new Image()
  },
  {
    name: 'audio',
    image: new Image()
  },
  {
    name: 'download',
    image: new Image()
  },
  {
    name: 'start',
    image: new Image()
  }
];

const masks = [];
const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  interact: false
};

const IDEAL_CHARACTER_SIZE = 0.05;
const IDEAL_INTERACTABLE_SIZE = 0.025;

const imgs = [new Image(), new Image(), new Image()];
const backgroundImage = new Image();
const backgroundWidth = 0;
const backgroundHeight = 0;

let characters = [];
let showInteractables = true;
let interactables = []; // LINKS, IMAGES, TEXT, VIDEO
let shapes = [];
let startingPoint = null;
let displayingMessages = false;
let showGuides = true;
let scale = 1.0;
let mouseX = 0;
let mouseY = 0;
let deletingInteractables = false;
let placingStartingPoint = false;
let placingInteractable;
let configuringInteractable;
let makingShapes = CAN_EDIT;
let maskSecondPoint = null;
let editingShapes = false;
let currentEditingShape;
let idealPlacingWidth;
let idealPlacingHeight;
let idealInteractablePlacingSize;
let interactableBox;
let showingInteractables = false;
let choosingLocalWarpPoint = false;
let potentialLocalWarpPoint;

function showMediaWithElement(element) {
  let old = document.querySelector('#mediaBox');

  if (old) old.remove();

  let box = document.createElement('div');
  box.id = 'mediaBox';
  box.style.width = `${scaledImageWidth()}px`;
  box.style.height = `${scaledImageHeight()}px`;
  box.style.position = 'absolute';
  box.style.top = 0;
  box.style.left = 0;
  box.style.display = 'flex';
  box.style.justifyContent = 'center';
  box.style.alignItems = 'center';
  box.style.padding = '10px 10px 10px 10px';

  let div = document.createElement('div');
  div.className = 'stripey';

  element.style.padding = '0';
  element.style.margin = '0';

  div.appendChild(element);
  box.appendChild(div);

  document.body.appendChild(box);
}

function showMediaWithData(data) {
  let old = document.querySelector('#mediaBox');

  if (old) old.remove();

  let box = document.createElement('div');
  box.id = 'mediaBox';
  box.style.width = `${scaledImageWidth()}px`;
  box.style.height = `${scaledImageHeight()}px`;
  box.style.position = 'absolute';
  box.style.top = 0;
  box.style.left = 0;
  box.style.display = 'flex';
  box.style.justifyContent = 'center';
  box.style.alignItems = 'center';
  box.style.padding = '10px 10px 10px 10px';

  let div = document.createElement('div');
  div.className = 'stripey';

  let e;
  switch (data.type) {
    case 'download':
      e = document.createElement('a');
      e.href = `/scenes/${SCENE_ID}/interactables/${data.id}/data`;
      e.innerText = 'download file';
      break;
    case 'audio':
      e = document.createElement('audio');
      e.controls = true;
      e.src = `/scenes/${SCENE_ID}/interactables/${data.id}/data`;
      break;
    case 'link':
      e = document.createElement('a');
      e.href = data.data.url;
      e.target = '_blank';
      e.innerText = data.data.description || data.data.url;
      break;
    case 'text':
      e = document.createElement('p');
      e.innerText = data.data.text;
      div.style.width = `${scaledImageWidth() / 2}px`;
      div.style.maxHeight = `${scaledImageHeight() / 2}px`;
      break;
  }

  e.style.backgroundColor = 'white';
  e.style.margin = '0';
  e.style.padding = '0';

  div.appendChild(e);
  box.appendChild(div);

  document.body.appendChild(box);
}

function resetForms() {
  let mb = document.querySelector('#mediaBox');

  if (mb) {
    mb.remove();
    placingInteractable = null;
    configuringInteractable = null;
    choosingLocalWarpPoint = false;
    potentialLocalWarpPoint = null;
    makeShapes();
    return true;
  } else {
    return false;
  }
}

function saveScales() {
  let paramsData = '';

  if (editingShapes && currentEditingShape) {
    let shapeTypeSelectValue = document.querySelector("#shapeType").value;

    currentEditingShape.nearScale = parseFloat(document.querySelector("#nearScale").value);
    currentEditingShape.farScale = parseFloat(document.querySelector("#farScale").value);
    currentEditingShape.type = shapeTypeSelectValue;

    paramsData = paramsData.concat(`near_scale=${currentEditingShape.nearScale}`);
    paramsData = paramsData.concat(`&far_scale=${currentEditingShape.farScale}`);
    paramsData = paramsData.concat(`&shape_type=${currentEditingShape.type}`);

    if (shapeTypeSelectValue == 'floor') {
      currentEditingShape.tiles = null;
      currentEditingShape.sortedTiles = null;
    } else if (shapeTypeSelectValue == 'mask') {
      currentEditingShape.tiles = tileMask(currentEditingShape);
      currentEditingShape.sortedTiles = null;
    }

    if (shapeTypeSelectValue != 'warp') {
      paramsData = paramsData.concat(`&warp=${null}`);

      let warpTo = shapes.filter(function (shape) {
        return currentEditingShape.warpData && shape.id == currentEditingShape.warpData.id;
      })[0];

      currentEditingShape.warpData = null;

      if (warpTo) {
        warpTo.warpData = null;
      }

      document.querySelector("#warpType").selectedIndex = -1;
      document.querySelector('#warpExtras').style.display = 'none';
    } else {
      document.querySelector('#warpExtras').style.display = 'block';
    }

    if (shapeTypeSelectValue == 'warp') {
      if (potentialLocalWarpPoint) {
        let warpTo = shapes.filter(function (shape) { return shape.id == potentialLocalWarpPoint })[0];

        if (warpTo) {
          let warpData = {
            type: 'local',
            id: warpTo.id
          };

          currentEditingShape.warpData = warpData;

          paramsData = paramsData.concat(`&warp=local|${warpTo.id}`);

          warpToData = {
            type: 'local',
            id: currentEditingShape.id
          };

          warpTo.warpData = warpToData;
        }

        potentialLocalWarpPoint = null;
        choosingLocalWarpPoint = false;
      } else {
        let remoteID = document.querySelector('#remoteWarpID').value;

        if (remoteID.length > 0) {
          paramsData = paramsData.concat(`&warp=remote|${remoteID}`);
        }
      }
    }

    postRequest(`/scenes/${SCENE_ID}/shapes/${currentEditingShape.id}`, paramsData, function(result) {
      if (result.error) {
        console.log('we have error: ' + result.error);
      } else {
        console.log(result);
      }

      draw();
    });

    document.querySelector('#saveScales').disabled = true;
    draw();
  }
}

function deleteShape() {
  if (editingShapes && currentEditingShape) {
    let index = shapes.findIndex(function (shape) { return shape.id == currentEditingShape.id; });

    if (index > -1) {
      if (shapes[index].type == 'warp' && shapes[index].warpData) {
        let warpTo = shapes.filter(function (shape) { return shape.id == shapes[index].warpData.id })[0];

        if (warpTo) warpTo.warpData = null;
      }

      postRequest(`/scenes/${SCENE_ID}/shapes/${currentEditingShape.id}/delete`, null, function(result) {
        if (result.error) {
          console.log('there has been an error: ' + result.error);
        } else {
          shapes.splice(index, 1);
          clearEditValues();
          makeShapes();
        }
      });
    }
  }
}

function clearEditValues() {
  currentEditingShape = null;
  document.querySelector("#nearScale").value = null;
  document.querySelector("#farScale").value = null;
  document.querySelector("#shapeType").selectedIndex = -1;
  document.querySelector("#warpType").selectedIndex = -1;
  document.querySelector("#remoteWarpID").value = null;
  document.querySelector('#saveScales').disabled = true;
  document.querySelector('#deleteShape').disabled = true;
}

function chooseWarpExit() {
}

function warpTypeChanged(elem) {
  if (editingShapes && currentEditingShape && (!currentEditingShape.warpData || elem.value != currentEditingShape.warpData.type)) {
    if (elem.value == 'local') {
      choosingLocalWarpPoint = true;
      document.querySelector('#remoteWarpID').style.display = 'none';
    } else if (elem.value == 'remote') {
      choosingLocalWarpPoint = false;
      document.querySelector('#remoteWarpID').style.display = 'block';
    }
  }

  draw();
}

function remoteWarpIDChanged(elem) {
  if (editingShapes && currentEditingShape && (!currentEditingShape.warpData || elem.value != currentEditingShape.warpData.id)) {
    choosingLocalWarpPoint = false;
    document.querySelector('#saveScales').disabled = false;
  }

  draw();
}

function shapeTypeChanged(elem) {
  if (editingShapes && currentEditingShape && elem.value != currentEditingShape.type) {
    document.querySelector('#saveScales').disabled = false;
  }

  draw();
}

function nearScaleChanged(elem) {
  if (editingShapes && currentEditingShape && elem.value != currentEditingShape.nearScale) {
    document.querySelector('#saveScales').disabled = false;
  }

  draw();
}

function farScaleChanged(elem) {
  if (editingShapes && currentEditingShape && elem.value != currentEditingShape.farScale) {
    document.querySelector('#saveScales').disabled = false;
  }

  draw();
}

function getValidUrl(url) {
  let newUrl = window.decodeURIComponent(url);

  newUrl = newUrl.trim().replace(/\s/g, "");

  if (/^(:\/\/)/.test(newUrl)) {
    return `http${newUrl}`;
  }

  if (!/^(f|ht)tps?:\/\//i.test(newUrl)) {
    return `http://${newUrl}`;
  }

  return newUrl;
}

function finishPlacingInteractable() {
  if (!idealInteractablePlacingSize) {
    let idealSize = backgroundImage.naturalWidth * IDEAL_INTERACTABLE_SIZE;
    let imageScale = idealSize / interactableTemplates[0].image.naturalWidth;

    idealInteractablePlacingSize = interactableTemplates[0].image.naturalWidth * imageScale;
  }

  let data = {};
  let form;

  switch (configuringInteractable.type) {
    case 'link':
      form = document.querySelector('.linkForm:not(.proto)');
      let url = getValidUrl(form.querySelector('.url').value);
      data.url = url;
      data.description = form.querySelector('.urlDescription').value || url;
      break;
    case 'text':
      form = document.querySelector('.textForm:not(.proto)');
      data.text = form.querySelector('textarea').value;
      break;
    case 'audio':
      form = document.querySelector('.audioForm:not(.proto)');
      data.file = form.querySelector('input[type=file]').files[0];
      break;
    case 'download':
      form = document.querySelector('.downloadForm:not(.proto)');
      data.file = form.querySelector('input[type=file]').files[0];
      break;
  }

  let params = {
    interactable_type: configuringInteractable.type,
    xp: configuringInteractable.x / scaledImageWidth(),
    yp: configuringInteractable.y / scaledImageHeight(),
    size: idealInteractablePlacingSize
  };

  for (const [key, value] of Object.entries(data)) {
    params[key] = value;
  }

  postData(`/scenes/${SCENE_ID}/interactables`, params, function(result) {
    if (result.error) {
      console.log('we have error: ' + result.error);
    } else {
      console.log(result);

      interactables.push({
        objectType: 'interactable',
        id: result._id.$oid,
        type: result.interactable_type,
        xp: result.xp,
        yp: result.yp,
        size: idealInteractablePlacingSize,
        url: result.url,
        description: result.description,
        text: result.text,
        file: result.file_url
      });

      console.log(interactables);
    }
  });

  makeShapes();
}

function generateUUID() { // Public Domain/MIT
  var d = new Date().getTime();//Timestamp
  var d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now() * 1000)) || 0;
  return 'xxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16;//random number between 0 and 16
    if (d > 0) {//Use timestamp until depleted
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {//Use microseconds since page-load if supported
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

canvas.onclick = function (e) {
  if (!CAN_EDIT) return;

  if (deletingInteractables) {
    let foundInteractableIndex = interactables.findIndex(function(interactable) {
      let iX = interactable.xp * scaledImageWidth();
      let iY = interactable.yp * scaledImageHeight();
      let distance = Math.sqrt(Math.pow(e.clientX - iX, 2) + Math.pow(e.clientY - iY, 2));

      if (distance < interactable.size) {
        return true;
      } else {
        return false;
      }
    });

    if (foundInteractableIndex != -1) {
      postRequest(`/scenes/${SCENE_ID}/interactables/${interactables[foundInteractableIndex].id}/delete`, null, function(result) {
        if (result.error) {
          console.log('oh no error: ' + result.error);
        } else {
          interactables.splice(foundInteractableIndex, 1);
        }

        draw();
      });
    }
  } else if (choosingLocalWarpPoint && currentEditingShape && currentEditingShape.type == 'warp') {
    let foundWarps = shapes.filter(function (shape) {
      return adaptedPointIsInPolygon({ x: e.clientX, y: e.clientY }, shape.points) &&
        shape.type == 'warp' &&
        shape.id != currentEditingShape.id
    });

    if (foundWarps.length > 0) {
      let foundWarp = foundWarps[0];
      potentialLocalWarpPoint = foundWarp.id;
      document.querySelector('#saveScales').disabled = false;
    } else {
      potentialLocalWarpPoint = null;
    }
  } else if (placingInteractable) {
    let form;

    if (placingInteractable == 'link') {
      form = document.querySelector('.linkForm').cloneNode(true);
      form.classList.remove('proto');
      form.style.display = 'block';
      form.style.position = 'relative';
      form.querySelector('button.go').onclick = finishPlacingInteractable;
      form.querySelector('button.cancel').onclick = makeShapes;
    } else if (placingInteractable == 'text') {
      form = document.querySelector('.textForm').cloneNode(true);
      form.classList.remove('proto');
      form.style.display = 'block';
      form.style.position = 'relative';
      form.querySelector('button.go').onclick = finishPlacingInteractable;
      form.querySelector('button.cancel').onclick = makeShapes;
    } else if (placingInteractable == 'audio') {
      form = document.querySelector('.audioForm').cloneNode(true);
      form.classList.remove('proto');
      form.style.display = 'block';
      form.style.position = 'relative';
      form.style.backgroundColor = 'white';
      form.onsubmit = function (e) {
        e.preventDefault();
        finishPlacingInteractable();
        return false;
      };
      form.querySelector('button.cancel').onclick = makeShapes;
    } else if (placingInteractable == 'download') {
      form = document.querySelector('.downloadForm').cloneNode(true);
      form.classList.remove('proto');
      form.style.display = 'block';
      form.style.position = 'relative';
      form.style.backgroundColor = 'white';
      form.onsubmit = function (e) {
        e.preventDefault();
        finishPlacingInteractable();
        return false;
      };
      form.querySelector('button.cancel').onclick = makeShapes;
    }

    showMediaWithElement(form);

    configuringInteractable = {
      type: placingInteractable,
      x: e.clientX,
      y: e.clientY
    };

    placingInteractable = null;
  } else if (editingShapes) {
    let clickedShapes = shapes.filter(function (shape) { return adaptedPointIsInPolygon({ x: e.clientX, y: e.clientY }, shape.points); });

    if (clickedShapes.length == 1) {
      currentEditingShape = clickedShapes[0];
      setEditDetails();
    } else if (clickedShapes.length > 1) {
      if (currentEditingShape) {
        let index = clickedShapes.findIndex(function (shape) {
          return shape.id == currentEditingShape.id;
        });

        if (index == -1) index = 0;

        index++;

        if (index >= clickedShapes.length) index = 0;

        currentEditingShape = clickedShapes[index];
        setEditDetails();
      } else {
        currentEditingShape = clickedShapes[0];
        setEditDetails();
      }
    }
  } else if (placingStartingPoint) {
    shapes.every(function (shape) {
      if (adaptedPointIsInPolygon({ x: e.clientX, y: e.clientY }, shape.points)) {
        let oldStartingPoint = {...startingPoint};
        let newXP = e.clientX / scaledImageWidth();
        let newYP = e.clientY / scaledImageHeight();

        startingPoint = {
          xp: newXP,
          yp: newYP,
          size: idealInteractablePlacingSize
        };

        let formData = `start_xp=${newXP}&start_yp=${newYP}`;

        postRequest(`/scenes/${SCENE_ID}`, formData, function(result) {
          if (result.error) {
            console.log('we had error: ' + result.error);
            startingPoint = {...oldStartingPoint};
          }

          draw();
        });

        makeShapes();
        return false;
      } else {
        return true;
      }
    });
  } else if (makingShapes) {
    if (points.length > 2) {
      let x = e.clientX;
      let y = e.clientY;

      if (points[0].x - 5 <= x &&
        points[0].x + 5 >= x &&
        points[0].y - 5 <= y &&
        points[0].y + 5 >= y) {

        let sortedPoints = [...points].sort(function (a, b) {
          if (a.y < b.y) {
            return -1;
          } else if (a.y > b.y) {
            return 1;
          } else {
            return 0;
          }
        });

        let betterPoints = points.splice(0, points.length).map(function (point) {
          return {
            xp: point.x / scaledImageWidth(),
            yp: point.y / scaledImageHeight()
          };
        });

        let minYP = sortedPoints[0].y / scaledImageHeight();
        let maxYP = sortedPoints[sortedPoints.length - 1].y / scaledImageHeight();

        let shape = {
          id: generateUUID(),
          objectType: 'shape',
          nearScale: 1.0,
          farScale: 0.5,
          points: betterPoints,
          minYP: minYP,
          maxYP: maxYP,
          type: 'floor',
          warpData: null
        }

        shapes.push(shape);

        let urlPoints = betterPoints.map(function(point) {
          return `xp=${point.xp},yp=${point.yp}|`;
        }).join('');

        urlPoints = urlPoints.slice(0, -1);

        let paramsData = `points=${urlPoints}&near_scale=${1.0}&far_scale=${0.5}&min_yp=${minYP}&max_yp=${maxYP}&shape_type=floor`;

        postRequest(`/scenes/${SCENE_ID}/shapes`, paramsData, function(result) {
          if (result.error) {
            console.log('we had error: ' + result.error);
          }

          shape.id = result._id.$oid;

          draw();
        });

        document.getElementById("placeStartingPoint").disabled = false
        document.getElementById("editShapes").disabled = false
      } else {
        points.push({ x: e.clientX, y: e.clientY });
      }
    } else {
      points.push({ x: e.clientX, y: e.clientY });
      document.getElementById("clearPoints").disabled = false
    }
  }

  draw();
}

function setEditDetails() {
  document.querySelector("#nearScale").value = currentEditingShape.nearScale;
  document.querySelector("#farScale").value = currentEditingShape.farScale;
  document.querySelector("#shapeType").value = currentEditingShape.type;
  document.querySelector("#deleteShape").disabled = false;

  if (currentEditingShape.type == 'warp') {
    document.querySelector('#warpExtras').style.display = 'block';

    if (currentEditingShape.warpData) {
      document.querySelector('#warpType').value = currentEditingShape.warpData.type;

      if (currentEditingShape.warpData.type == 'remote') {
        document.querySelector('#remoteWarpID').value = currentEditingShape.warpData.id;
        document.querySelector('#remoteWarpID').style.display = 'block';
      } else {
        document.querySelector('#remoteWarpID').style.display = 'none';
      }
    }
  } else {
    document.querySelector('#warpExtras').style.display = 'none';
  }
}

function scaledImageWidth() {
  return backgroundImage.naturalWidth * scale;
}

function scaledImageHeight() {
  return backgroundImage.naturalHeight * scale;
}

function capitalize(word) {
  let lower = word.toLowerCase();
  return word.charAt(0).toUpperCase() + lower.slice(1);
}

function deleteInteractables() {
  placingStartingPoint = false;
  makingShapes = false;
  editingShapes = false;
  placingInteractable = null;
  configuringInteractable = null;
  choosingLocalWarpPoint = false;
  potentialLocalWarpPoint = null;
  deletingInteractables = true;

  clearEditValues();
  resetForms();

  document.getElementById("placeStartingPoint").disabled = false;
  document.getElementById("makeShapes").disabled = false;
  document.getElementById("addLink").disabled = false;
  document.getElementById("addText").disabled = false;
  document.getElementById("addAudio").disabled = false;
  document.getElementById("addDownload").disabled = false;
  document.getElementById("deleteInteractables").disabled = true;
}

function addInteractable(type) {
  placingStartingPoint = false;
  makingShapes = false;
  editingShapes = false;
  placingInteractable = type;
  configuringInteractable = null;
  choosingLocalWarpPoint = false;
  potentialLocalWarpPoint = null;
  deletingInteractables = false;

  clearEditValues();
  resetForms();

  document.getElementById("placeStartingPoint").disabled = false;
  document.getElementById("makeShapes").disabled = false;
  document.getElementById(`add${capitalize(type)}`).disabled = true;

  if (shapes.length > 0) {
    document.getElementById("editShapes").disabled = false;
  }

  document.getElementById("shapeEditor").style.display = "none";

  points.splice(0, points.length);

  canvas.onmousemove = function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    draw();
  }

  draw();
}

function makeShapes() {
  placingStartingPoint = false;
  makingShapes = true;
  editingShapes = false;
  placingInteractable = null;
  configuringInteractable = null;
  choosingLocalWarpPoint = false;
  potentialLocalWarpPoint = null;
  deletingInteractables = false;

  canvas.onmousemove = null;

  clearEditValues();
  resetForms();

  if (CAN_EDIT) {
    document.getElementById("placeStartingPoint").disabled = false;
    document.getElementById("makeShapes").disabled = true;
    document.getElementById("addLink").disabled = false;
    document.getElementById("deleteInteractables").disabled = false;
    document.getElementById("addText").disabled = false;
    document.getElementById("addAudio").disabled = false;
    document.getElementById("addDownload").disabled = false;

    if (shapes.length > 0) {
      document.getElementById("editShapes").disabled = false;
    }

    document.getElementById("shapeEditor").style.display = "none";
  } else {
    toggleGuides();
  }

  points.splice(0, points.length);

  canvas.onmousemove = null;

  draw();
}

function placeStartingPoint() {
  placingStartingPoint = true;
  makingShapes = false;
  editingShapes = false;
  placingInteractable = null;
  configuringInteractable = null;
  choosingLocalWarpPoint = false;
  potentialLocalWarpPoint = null;
  deletingInteractables = false;

  clearEditValues();
  resetForms();

  document.getElementById("placeStartingPoint").disabled = true;
  document.getElementById("makeShapes").disabled = false;
  document.getElementById("addLink").disabled = false;
  document.getElementById("deleteInteractables").disabled = false;
  document.getElementById("addText").disabled = false;
  document.getElementById("addAudio").disabled = false;
  document.getElementById("addDownload").disabled = false;

  if (shapes.length > 0) {
    document.getElementById("editShapes").disabled = false;
  }

  document.getElementById("shapeEditor").style.display = "none";

  canvas.onmousemove = function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    draw();
  }

  draw();
}

function editShapes() {
  placingStartingPoint = false;
  makingShapes = false;
  editingShapes = true;
  placingInteractable = null;
  configuringInteractable = null;
  choosingLocalWarpPoint = false;
  potentialLocalWarpPoint = null;
  deletingInteractables = false;

  clearEditValues();
  resetForms();

  document.getElementById("placeStartingPoint").disabled = false;
  document.getElementById("makeShapes").disabled = false;
  document.getElementById("addLink").disabled = false;
  document.getElementById("deleteInteractables").disabled = false;
  document.getElementById("addText").disabled = false;
  document.getElementById("addAudio").disabled = false;
  document.getElementById("addDownload").disabled = false;
  document.getElementById("editShapes").disabled = true;
  document.getElementById("shapeEditor").style.display = "block";

  canvas.onmousemove = null;

  draw()
}

function clearPoints() {
  points.splice(0, points.length);
  document.getElementById("clearPoints").disabled = true
  document.getElementById("shapeEditor").style.display = "none";

  clearEditValues();
  makeShapes();

  draw();
}

function toggleInteractables() {
  showInteractables = !showInteractables;
  document.getElementById("toggleInteractables").innerText = showInteractables ? "hide interactables" : "show interactables";
  draw();
}

function joinScene() {
  if (!startingPoint) {
    console.log("no starting point!");
    return;
  }

  let width = idealPlacingWidth;
  let height = idealPlacingHeight;

  if (!width || !height) {
    let imageScale = 0;
    let idealSize;

    if (backgroundImage.naturalWidth > backgroundImage.naturalHeight) {
      idealSize = backgroundImage.naturalWidth * .1;
    } else {
      idealSize = backgroundImage.naturalHeight * .1;
    }

    if (imgs[0].naturalWidth > imgs[0].naturalHeight) {
      imageScale = idealSize / imgs[0].naturalWidth;
    } else {
      imageScale = idealSize / imgs[0].naturalHeight;
    }

    width = imgs[0].naturalWidth * imageScale;
    height = imgs[0].naturalHeight * imageScale;
  }

  let startShapes = shapes.filter(function (shape) {
    return adaptedPointIsInPolygon({x: startingPoint.xp * scaledImageWidth(), y: startingPoint.yp * scaledImageHeight()}, shape.points);
  });

  if (startShapes.length == 0) {
    console.log("start point isn't in a shape");
    return;
  }

  if (startShapes[0].type != 'floor') {
    console.log("start point isn't in a FLOOR");
    return;
  }

  characters.unshift({
    objectType: 'character',
    id: CHARACTER_ID,
    images: imgs,
    xp: startingPoint.xp,
    yp: startingPoint.yp,
    width: width,
    height: height,
    shape: startShapes[0],
    flip: false,
    frame: 0,
    warpedTo: null
  })

  canControl = true;
  idealPlacingWidth = null;
  idealPlacingHeight = null;
  canvas.onmousemove = null;

  let params = `xp=${startingPoint.xp}&yp=${startingPoint.yp}&scene_id=${SCENE_ID}`;

  postRequest(`/users/${USER_ID}/character/update`, params, function(result) {
    if (result.error) {
      console.log(`something happened: ${result.error}`);
    } else {
      console.log('i guess it all went okay?');
    }
  });

  makeShapes();
}

function toggleGuides() {
  resetForms();

  if (showGuides) {
    if (CAN_EDIT) {
      document.getElementById("placeStartingPoint").style.display = "none";
      document.getElementById("makeShapes").style.display = "none";
      document.getElementById("editShapes").style.display = "none";
      document.getElementById("shapeEditor").style.display = "none";
      document.getElementById("clearPoints").style.display = "none";
      document.getElementById("addLink").style.display = "none";
      document.getElementById("deleteInteractables").style.display = "none";
      document.getElementById("addText").style.display = "none";
      document.getElementById("addAudio").style.display = "none";
      document.getElementById("addDownload").style.display = "none";
      document.getElementById("toggleGuides").innerText = "show guides";
    }
    showGuides = false;
    draw();
  } else {
    if (CAN_EDIT) {
      document.getElementById("placeStartingPoint").style.display = "block";
      document.getElementById("makeShapes").style.display = "block";
      document.getElementById("editShapes").style.display = "block";
      document.getElementById("clearPoints").style.display = "block";
      document.getElementById("shapeEditor").style.display = "none";
      document.getElementById("addLink").style.display = "block";
      document.getElementById("deleteInteractables").style.display = "block";
      document.getElementById("addText").style.display = "block";
      document.getElementById("addAudio").style.display = "block";
      document.getElementById("addDownload").style.display = "block";
      document.getElementById("toggleGuides").innerText = "hide guides";
    }
    showGuides = true;
    makeShapes();
  }
}

function resize() {
  resetForms();
  canvas.width = scaledImageWidth();
  canvas.height = scaledImageHeight();
}

function draw() {
  let ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(backgroundImage, 0, 0, scaledImageWidth(), scaledImageHeight());

  if (!showGuides) {
    shapes.filter(function (shape) { return shape.type == 'mask'; }).forEach(function (shape) {
      shape.tiles.forEach(function (tile) {
        if (!tile.data) {
          tile.data = ctx.getImageData(
            tile.xp * scaledImageWidth(),
            tile.yp * scaledImageHeight(),
            tile.sxp * scaledImageWidth(),
            tile.syp * scaledImageWidth()
          );
        }
      });
    });
  } else {
    ctx.fillStyle = "rgba(255, 0, 0, 1.0)";

    if (points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let n = 1; n < points.length; n++) {
        ctx.lineTo(points[n].x, points[n].y);
        ctx.stroke();
      }

      for (let n = 0; n < points.length; n++) {
        ctx.beginPath();
        ctx.rect(points[n].x - 2.5, points[n].y - 2.5, 5, 5);
        ctx.fill()
      }
    }

    for (let n = 0; n < shapes.length; n++) {
      ctx.beginPath();

      if (editingShapes && currentEditingShape) {
        if (shapes[n].id == currentEditingShape.id) {
          ctx.fillStyle = "rgba(0, 255, 0, 1.0)";
        } else {
          if (choosingLocalWarpPoint && shapes[n].type == 'warp') {
            ctx.fillStyle = "rgba(255, 0, 255, 1.0)";
          } else if (currentEditingShape.type == 'warp' && currentEditingShape.warpData && currentEditingShape.warpData.id == shapes[n].id) {
            ctx.fillStyle = "rgba(0, 255, 255, 1.0)";
          } else {
            ctx.fillStyle = "rgba(220, 220, 220, 0.5)";
          }
        }
      } else {
        if (shapes[n].type == 'floor') {
          ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
        } else if (shapes[n].type == 'mask') {
          ctx.fillStyle = "rgba(0, 0, 255, 0.5)";
        } else if (shapes[n].type == 'warp') {
          ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
        } else if (shapes[n].type == 'block') {
          ctx.fillStyle = "rgba(255, 0, 255, 0.5)";
        }
      }

      ctx.moveTo(shapes[n].points[0].xp * scaledImageWidth(), shapes[n].points[0].yp * scaledImageHeight());

      for (let m = 1; m < shapes[n].points.length; m++) {
        ctx.lineTo(shapes[n].points[m].xp * scaledImageWidth(), shapes[n].points[m].yp * scaledImageHeight());
      }

      ctx.fill();

      if (shapes[n].type == 'warp' && shapes[n].warpData && shapes[n].warpData.type == 'local' && shapes[n].warpData.id) {
        let warpTo = shapes.filter(function (shape) { return shape.id == shapes[n].warpData.id })[0];

        if (warpTo) {
          ctx.beginPath();
          ctx.moveTo(shapes[n].points[0].xp * scaledImageWidth(), shapes[n].points[0].yp * scaledImageHeight());
          ctx.lineTo(warpTo.points[0].xp * scaledImageWidth(), warpTo.points[0].yp * scaledImageHeight());
          ctx.stroke();
        }
      } else if (editingShapes && currentEditingShape && currentEditingShape.id == shapes[n].id && potentialLocalWarpPoint) {
        let warpTo = shapes.filter(function (shape) { return shape.id == potentialLocalWarpPoint })[0];

        if (warpTo) {
          ctx.beginPath();
          ctx.moveTo(shapes[n].points[0].xp * scaledImageWidth(), shapes[n].points[0].yp * scaledImageHeight());
          ctx.lineTo(warpTo.points[0].xp * scaledImageWidth(), warpTo.points[0].yp * scaledImageHeight());
          ctx.stroke();
        }
      }
    }

    shapes.filter(function (shape) { return shape.type == 'mask'; }).forEach(function (shape) {
      shape.tiles.forEach(function (tile) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${getRandomInt(256)}, ${getRandomInt(256)}, ${getRandomInt(256)}, 1.0)`;
        ctx.rect(tile.xp * scaledImageWidth(), tile.yp * scaledImageHeight(), tile.sxp * scaledImageWidth(), tile.syp * scaledImageHeight());
        ctx.fill();
      });
    });
    
    if (startingPoint) {
      if (!idealInteractablePlacingSize) {
        let idealSize = backgroundImage.naturalWidth * IDEAL_INTERACTABLE_SIZE;
        let imageScale = idealSize / interactableTemplates[0].image.naturalWidth;

        idealInteractablePlacingSize = interactableTemplates[0].image.naturalWidth * imageScale;
      }

      let image = interactableTemplates.filter(function (template) { return template.name == 'start'; })[0].image;

      drawImage(
        ctx,
        image,
        (startingPoint.xp * scaledImageWidth()) - (idealInteractablePlacingSize / 2),
        (startingPoint.yp * scaledImageHeight()) - (idealInteractablePlacingSize / 2),
        idealInteractablePlacingSize,
        idealInteractablePlacingSize 
      );
    }
  }

  let ci = collidingInteractables();

  sortedDrawables().forEach(function (drawable) {
    if (drawable.type == 'character') {
      drawImage(
        ctx,
        drawable.elem.images[drawable.elem.frame == 0 ? 0 : (drawable.elem.frame < 3 ? 1 : 2)],
        drawable.x,
        drawable.y,
        drawable.width,
        drawable.height,
        0,
        drawable.elem.flip
      );
    } else if (!showGuides && drawable.type == 'mask') {
      drawable.elem.tiles.forEach(function (tile) {
        ctx.putImageData(tile.data, tile.xp * scaledImageWidth(), tile.yp * scaledImageHeight());
      });
    } else if (drawable.type == 'interactable' && showInteractables) {
      let interactable = drawable.elem;
      let image = interactableTemplates.filter(function (template) { return template.name == interactable.type; })[0].image;

      if (ci.findIndex(function (c) { return c == interactable; }) != -1) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(255, 0, 0, 1.0)";
        ctx.arc(
          interactable.xp * scaledImageWidth(),
          interactable.yp * scaledImageHeight(),
          interactable.size * 0.75,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }

      drawImage(
        ctx,
        image,
        (interactable.xp * scaledImageWidth()) - (interactable.size / 2),
        (interactable.yp * scaledImageHeight()) - (interactable.size / 2),
        interactable.size,
        interactable.size
      );
    }
  });

  if (placingStartingPoint) {
    if (!idealInteractablePlacingSize) {
      let idealSize = backgroundImage.naturalWidth * IDEAL_INTERACTABLE_SIZE;
      let imageScale = idealSize / interactableTemplates[0].image.naturalWidth;

      idealInteractablePlacingSize = interactableTemplates[0].image.naturalWidth * imageScale;
    }

    ctx.globalAlpha = 0.5;

    let image = interactableTemplates.filter(function (template) { return template.name == 'start'; })[0].image;

    drawImage(
      ctx,
      image,
      mouseX - (idealInteractablePlacingSize / 2),
      mouseY - (idealInteractablePlacingSize / 2),
      idealInteractablePlacingSize,
      idealInteractablePlacingSize
    );

    ctx.globalAlpha = 1.0;
  } else if (configuringInteractable) {
    if (!idealInteractablePlacingSize) {
      let idealSize = backgroundImage.naturalWidth * IDEAL_INTERACTABLE_SIZE;
      let imageScale = idealSize / interactableTemplates[0].image.naturalWidth;

      idealInteractablePlacingSize = interactableTemplates[0].image.naturalWidth * imageScale;
    }

    ctx.globalAlpha = 0.5;

    let image = interactableTemplates.filter(function (template) { return template.name == configuringInteractable.type; })[0].image;

    drawImage(
      ctx,
      image,
      configuringInteractable.x - (idealInteractablePlacingSize / 2),
      configuringInteractable.y - (idealInteractablePlacingSize / 2),
      idealInteractablePlacingSize,
      idealInteractablePlacingSize
    );

    ctx.globalAlpha = 1.0;
  } else if (placingInteractable) {
    if (!idealInteractablePlacingSize) {
      let idealSize = backgroundImage.naturalWidth * IDEAL_INTERACTABLE_SIZE;
      let imageScale = idealSize / interactableTemplates[0].image.naturalWidth;

      idealInteractablePlacingSize = interactableTemplates[0].image.naturalWidth * imageScale;
    }

    ctx.globalAlpha = 0.5;

    let image = interactableTemplates.filter(function (template) { return template.name == placingInteractable; })[0].image;

    drawImage(
      ctx,
      image,
      mouseX - (idealInteractablePlacingSize / 2),
      mouseY - (idealInteractablePlacingSize / 2),
      idealInteractablePlacingSize,
      idealInteractablePlacingSize
    );

    ctx.globalAlpha = 1.0;
  }
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function collidingInteractables() {
  if (interactables.length == 0) return [];

  return characters.map(function (character) {
    let tScale = ((character.yp * scaledImageHeight()) - (character.shape.minYP * scaledImageHeight())) / ((character.shape.maxYP * scaledImageHeight()) - (character.shape.minYP * scaledImageHeight())) * (character.shape.nearScale - character.shape.farScale) + character.shape.farScale;

    let yTop = (character.yp * scaledImageHeight()) - interactables[0].size;
    let yBottom = character.yp * scaledImageHeight();

    let s = (character.width / 2) * tScale;
    let xLeft = character.xp * scaledImageWidth() - s;
    let xRight = character.xp * scaledImageWidth() + s;

    return interactables.filter(function (interactable) {
      let iX = interactable.xp * scaledImageWidth();
      let iY = interactable.yp * scaledImageHeight();

      return (iY >= yTop && iY <= yBottom && iX <= xRight && iX >= xLeft);
    });
  }).flat();
}

function sortedDrawables() {
  return characters.concat(interactables).concat(shapes.filter(function (shape) { return shape.type == 'mask'; })).map(function (elem) {
    if (elem.objectType == 'shape') {
      if (!elem.sortedTiles) {
        elem.sortedTiles = [...elem.tiles].sort(function (a, b) {
          if ((a.yp * scaledImageHeight()) + a.syp < (b.yp * scaledImageHeight()) + b.syp) {
            return 1;
          } else if ((a.yp * scaledImageHeight()) + a.syp > (b.yp * scaledImageHeight()) + b.syp) {
            return -1;
          } else {
            return 0;
          }
        });
      }

      return {
        elem: elem,
        type: 'mask',
        bottom: (elem.sortedTiles[0].yp * scaledImageHeight()) + elem.sortedTiles[0].syp
      };
    } else if (elem.objectType == 'character') {
      let tScale = ((elem.yp * scaledImageHeight()) - (elem.shape.minYP * scaledImageHeight())) / ((elem.shape.maxYP * scaledImageHeight()) - (elem.shape.minYP * scaledImageHeight())) * (elem.shape.nearScale - elem.shape.farScale) + elem.shape.farScale;

      return {
        elem: elem,
        type: 'character',
        x: (elem.xp * scaledImageWidth()) - ((elem.width / 2) * tScale),
        y: (elem.yp * scaledImageHeight()) - (elem.height * tScale),
        width: elem.width * tScale,
        height: elem.height * tScale,
        bottom: elem.yp * scaledImageHeight()
      };
    } else if (elem.objectType == 'interactable') {
      return {
        elem: elem,
        type: 'interactable',
        bottom: (elem.yp * scaledImageHeight()) + (elem.size / 2)
      }
    }
  }).sort(function (a, b) {
    if (a.bottom < b.bottom) {
      return -1;
    } else if (a.bottom > b.bottom) {
      return 1;
    } else {
      return 0;
    }
  });
}

function tileMask(mask) {
  let tiles = [];

  let points = mask.points.map(function (point) {
    return { x: point.xp * scaledImageWidth(), y: point.yp * scaledImageHeight() };
  });

  let minX = Math.floor([...points].sort(function (a, b) { return a.x > b.x; })[0].x);
  let minY = Math.floor([...points].sort(function (a, b) { return a.y > b.y; })[0].y);
  let maxX = Math.floor([...points].sort(function (a, b) { return a.x < b.x; })[0].x);
  let maxY = Math.floor([...points].sort(function (a, b) { return a.y < b.y; })[0].y);

  let y = minY;
  while (y < maxY) {
    let x = minX;

    while (x < maxX) {
      let square = [
        { x: x, y: y },
        { x: x + 5, y: y },
        { x: x, y: y + 5 },
        { x: x + 5, y: y + 5 }
      ];

      let isIn = false;
      square.forEach(function (point) {
        if (adaptedPointIsInPolygon(point, mask.points)) {
          isIn = true;
          return false;
        } else {
          return true;
        }
      });

      if (isIn) {
        tiles.push({
          xp: square[0].x / scaledImageWidth(),
          yp: square[0].y / scaledImageHeight(),
          sxp: 5 / scaledImageWidth(),
          syp: 5 / scaledImageHeight()
        });
      }

      x = x + 5;
    }

    y = y + 5;
  }

  return tiles;
}

function pointIsInPolygon(p, polygon) {
  let isInside = false;

  let minX = polygon[0].x, maxX = polygon[0].x;
  let minY = polygon[0].y, maxY = polygon[0].y;

  for (let n = 1; n < polygon.length; n++) {
    let q = polygon[n];
    minX = Math.min(q.x, minX);
    maxX = Math.max(q.x, maxX);
    minY = Math.min(q.y, minY);
    maxY = Math.max(q.y, maxY);
  }

  if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) {
    return false;
  }

  let i = 0, j = polygon.length - 1;
  for (i, j; i < polygon.length; j = i++) {
    if ((polygon[i].y > p.y) != (polygon[j].y > p.y) &&
      p.x < (polygon[j].x - polygon[i].x) * (p.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function adaptedPointIsInPolygon(p, polygon) {
  let adaptedPolygon = polygon.map(function (point) {
    return { x: point.xp * scaledImageWidth(), y: point.yp * scaledImageHeight() };
  });

  return pointIsInPolygon(p, adaptedPolygon);
}

window.onresize = function () {
  calculateImageSize();
  resize();

  idealPlacingWidth = null;
  idealPlacingHeight = null;
  idealInteractablePlacingSize = null;

  shapes.filter(function (shape) { return shape.type == 'mask'; }).forEach(function (shape) {
    shape.tiles = tileMask(shape);
    shape.sortedTiles = null;
  });

  draw();
}

window.onload = function () {
  backgroundImage.onload = function() {
    calculateImageSize();
    resize();
    draw();

    getRequest(`/scenes/${SCENE_ID}/json`, function(data) {
      console.log(data);

      let user = data.user;
      let scene = data.scene;

      if (scene.start_xp) {
        startingPoint = {
          xp: scene.start_xp,
          yp: scene.start_yp
        };
      }

      if (scene.shapes) {
        shapes = scene.shapes.map(function(shape) {
          return {
            id: shape.id,
            objectType: 'shape',
            nearScale: shape.near_scale,
            farScale: shape.far_scale,
            minYP: shape.min_yp,
            maxYP: shape.max_yp,
            type: shape.shape_type,
            points: shape.points.map(function(point) { return {xp: parseFloat(point.xp), yp: parseFloat(point.yp)}; }),
            warpData: shape.warp ? {id: shape.warp.warp_id, type: shape.warp.warp_type} : null
          };
        });

        shapes.filter(function (shape) { return shape.type == 'mask'; }).forEach(function (shape) {
          shape.tiles = tileMask(shape);
          shape.sortedTiles = null;
        });
      }

      if (scene.interactables) {
        interactables = scene.interactables.map(function(interactable) {
          return {
            objectType: 'interactable',
            id: interactable.id,
            type: interactable.interactable_type,
            data: interactable.data,
            xp: interactable.xp,
            yp: interactable.yp,
            size: interactable.size,
            url: interactable.url,
            description: interactable.description,
            text: interactable.text,
            file: interactable.file_url
          }
        });
      }

      if (scene.characters) {
        console.log(scene.characters, CHARACTER_ID);
        characters = scene.characters.map(function(character) {
          return {
            objectType: 'character',
            id: character.id,
            images: [new Image(), new Image(), new Image()],
            xp: character.xp,
            yp: character.yp,
            shape: shapes.filter(function(shape) {
              return adaptedPointIsInPolygon({ x: character.xp * scaledImageWidth(), y: character.yp * scaledImageHeight() }, shape.points) &&
                     shape.type == 'floor';
            })[0],
            flip: false,
            frame: 0,
            warpedTo: null
          }
        });

        if (characters.length > 0) {
          if (CHARACTER_ID) {
            let foundMyOwnCharacterIndex = characters.findIndex(function(character) { return character.id == CHARACTER_ID; });

            if (foundMyOwnCharacterIndex > -1) {
              let character = characters.splice(foundMyOwnCharacterIndex, 1)[0];
              characters.unshift(character);
              canControl = true;
            }
          }

          let index = 0;
          Promise.all(characters.map(function(character) {
            return character.images;
          }).flat().map(function(image) {
            return new Promise(function(resolve, reject) {
              image.onload = function() {
                resolve(image);
              };

              image.src = `/characters/${characters[Math.floor(index / 3)].id}/images/${index % 3}`
              index++;
            });
          })).then(function() {
            characters.forEach(function(character) {
              let imageScale = 0;
              let idealSize;

              if (backgroundImage.naturalWidth > backgroundImage.naturalHeight) {
                idealSize = backgroundImage.naturalWidth * .1;
              } else {
                idealSize = backgroundImage.naturalHeight * .1;
              }

              if (character.images[0].naturalWidth > character.images[0].naturalHeight) {
                imageScale = idealSize / character.images[0].naturalWidth;
              } else {
                imageScale = idealSize / character.images[0].naturalHeight;
              }

              character.width = character.images[0].naturalWidth * imageScale;
              character.height = character.images[0].naturalHeight * imageScale;
            });

            makeShapes();
          });
        } else {
          makeShapes();
        }
      }

      if (user && user.character && user.has_images) {
        imgs[0].src = `/characters/${user.character.id}/images/0`;
        imgs[1].src = `/characters/${user.character.id}/images/1`;
        imgs[2].src = `/characters/${user.character.id}/images/2`;
      }
    });
  };

  backgroundImage.src = `/scenes/${SCENE_ID}/image`;

  interactableTemplates.forEach(function (t) {
    t.image.src = `/interactable_templates/${t.name}/image`;
  });
}

function calculateImageSize() {
  if (backgroundImage.naturalWidth > backgroundImage.naturalHeight) {
    if (backgroundImage.naturalWidth > window.innerWidth) {
      scale = window.innerWidth / backgroundImage.naturalWidth;

      if (scaledImageHeight() > window.innerHeight) {
        scale = window.innerHeight / backgroundImage.naturalHeight;
      }
    } else if (backgroundImage.naturalHeight > window.innerHeight) {
      scale = window.innerHeight / backgroundImage.naturalHeight;
    } else {
      scale = 1.0;
    }
  } else if (backgroundImage.naturalWidth < backgroundImage.naturalHeight) {
    if (backgroundImage.naturalHeight > window.innerHeight) {
      scale = window.innerHeight / backgroundImage.naturalHeight;

      if (scaledImageWidth() > window.innerWidth) {
        scale = window.innerWidth / backgroundImage.naturalWidth;
      }
    } else if (backgroundImage.naturalWidth > window.innerWidth) {
      scale = window.innerWidth / backgroundImage.naturalWidth;
    } else {
      scale = 1.0;
    }
  } else {
    if (window.innerWidth > window.innerHeight) {
      scale = window.innerHeight / backgroundImage.naturalHeight;
    } else {
      scale = window.innerWidth / backgroundImage.naturalWidth;
    }
  }
}

function drawImage(context, image, x, y, width, height, deg, flip, flop, center) {
  context.save();

  if (typeof width === "undefined") width = image.width;
  if (typeof height === "undefined") height = image.height;
  if (typeof center === "undefined") center = false;

  // Set rotation point to center of image, instead of top/left
  if (center) {
    x -= width / 2;
    y -= height / 2;
  }

  // Set the origin to the center of the image
  context.translate(x + width / 2, y + height / 2);

  // Rotate the canvas around the origin
  var rad = 2 * Math.PI - deg * Math.PI / 180;
  context.rotate(rad);

  // Flip/flop the canvas
  if (flip) flipScale = -1; else flipScale = 1;
  if (flop) flopScale = -1; else flopScale = 1;
  context.scale(flipScale, flopScale);

  // Draw the image    
  context.drawImage(image, -width / 2, -height / 2, width, height);

  context.restore();
}

const t = setInterval(function () {
  if (characters.length === 0) {
    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
    keys.interact = false;
    return;
  }

  if (!canControl) {
    return;
  }

  let newXP = characters[0].xp;
  let newYP = characters[0].yp;
  let xInc = (5 / scaledImageWidth());
  let yInc = (5 / scaledImageHeight());
  let changed = false;

  if (keys.interact) {
    if (showingInteractables) {
      resetForms();
      showingInteractables = false;
    } else {
      let ci = collidingInteractables();

      if (ci.length > 0) {
        showMediaWithData(ci[0]);
        showingInteractables = true;
      }
    }

    keys.interact = false;
  }

  if (keys.up) {
    newYP = newYP - yInc;

    maybeAdjustFrame(changed, characters[0]);

    changed = true;
  } else {
    keys.up = false;
  }

  if (keys.down) {
    newYP = newYP + yInc;

    maybeAdjustFrame(changed, characters[0]);

    changed = true;
  } else {
    keys.down = false;
  }

  if (keys.left) {
    newXP = newXP - xInc;
    characters[0].flip = false;

    maybeAdjustFrame(changed, characters[0]);

    changed = true;
  } else {
    keys.left = false;
  }

  if (keys.right) {
    newXP = newXP + xInc;
    characters[0].flip = true;

    maybeAdjustFrame(changed, characters[0]);

    changed = true;
  } else {
    keys.right = false;
  }

  if (changed) {
    didMoveLastFrame = true;

    let xShapes = {};
    let yShapes = {};

    shapes.filter(function (shape) {
      return shape.type == 'floor' || shape.type == 'block' || shape.type == 'warp';
    }).forEach(function (shape) {
      if (adaptedPointIsInPolygon({ x: newXP * scaledImageWidth(), y: characters[0].yp * scaledImageHeight() }, shape.points)) {
        xShapes[shape.type] = shape;
      }

      if (adaptedPointIsInPolygon({ x: characters[0].xp * scaledImageWidth(), y: newYP * scaledImageHeight() }, shape.points)) {
        yShapes[shape.type] = shape;
      }
    });

    let foundWarpX, foundWarpY, xShape, yShape;

    if (xShapes['block']) {
      // do nothing right now
    } else if (xShapes['warp'] && xShapes['warp'].warpData) {
      if (characters[0].warpedTo && characters[0].warpedTo.id == xShapes['warp'].id) {
        characters[0].xp = newXP;
      } else {
        foundWarpX = xShapes['warp'];
      }
    } else if (xShapes['floor']) {
      characters[0].xp = newXP;
      xShape = xShapes['floor'];
    }

    if (yShapes['block']) {
      // do nothing right now
    } else if (yShapes['warp'] && yShapes['warp'].warpData) {
      if (characters[0].warpedTo && characters[0].warpedTo.id == yShapes['warp'].id) {
        characters[0].yp = newYP;
      } else {
        foundWarpY = yShapes['warp'];
      }
    } else if (yShapes['floor']) {
      characters[0].yp = newYP;
      yShape = yShapes['floor'];
    }

    if (foundWarpX && foundWarpX.warpData) {
      if (foundWarpX.warpData.type == 'remote') {
        // '/characters/:character_id/warp/:warp_id'
        postRequest(`/characters/${characters[0].id}/warp/${foundWarpX.warpData.id}`, null, function(result) {
          if (result.error) {
            console.log('oh no', error);
          } else {
            window.location.href = `/scenes/${foundWarpX.warpData.id}`
          }
        });
      } else if (foundWarpX.warpData.type == 'local') {
        let warpTo = shapes.filter(function (shape) { return shape.id == foundWarpX.warpData.id })[0];

        characters[0].warpedTo = warpTo;
        characters[0].shape = warpTo;
        characters[0].xp = warpTo.points[0].xp;
        characters[0].yp = warpTo.points[0].yp;
      }
    } else if (foundWarpY && foundWarpY.warpData) {
      if (foundWarpY.warpData.type == 'remote') {
        postRequest(`/characters/${characters[0].id}/warp/${foundWarpY.warpData.id}`, null, function(result) {
          if (result.error) {
            console.log('oh no', error);
          } else {
            window.location.href = `/scenes/${foundWarpY.warpData.id}`
          }
        });
      } else if (foundWarpY.warpData.type == 'local') {
        let warpTo = shapes.filter(function (shape) { return shape.id == foundWarpY.warpData.id })[0];

        characters[0].warpedTo = warpTo;
        characters[0].shape = warpTo;
        characters[0].xp = warpTo.points[0].xp;
        characters[0].yp = warpTo.points[0].yp;
      }
    } else if (xShape &&
      yShape &&
      xShape.id == yShape.id &&
      xShape.id != characters[0].shape.id) {
      characters[0].shape = xShape;
      characters[0].warpedTo = null;
    }
  } else {
    characters[0].frame = 0;

    if (didMoveLastFrame && USER_ID && characters[0].shape.type == 'floor') {
      let params = `xp=${characters[0].xp}&yp=${characters[0].yp}`;
      postRequest(`/users/${USER_ID}/character/update`, params, function(data, error) {
        if (error) {
          console.log('oh no', error);
        } else {
          console.log('i guess it was fine?');
        }
      });
    }

    didMoveLastFrame = false;
  }

  draw();
}, 50);

function maybeAdjustFrame(changed, character) {
  if (!changed) {
    character.frame++;
    if (character.frame == 5) character.frame = 1;
  }
}

function getRequest(url, callback) {
  let xhr = new XMLHttpRequest();
  xhr.open("GET", url);
  xhr.setRequestHeader("Accept", "application/json");
  xhr.setRequestHeader("HTTP_X_REQUESTED_WITH", "XMLHttpRequest");
  xhr.onreadystatechange = function () {
    if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
      callback(JSON.parse(this.response));
    }
  }
  xhr.send();
}

function postRequest(url, paramsData, callback) {
  let xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.setRequestHeader('X-CSRF-Token', AUTH_TOKEN);
  xhr.onreadystatechange = function() {
    if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
      callback(JSON.parse(this.response));
    }
  }

  if (paramsData) {
    xhr.send(paramsData);
  } else {
    xhr.send();
  }
}

function postData(url, params, callback) {
  let fd = new FormData();
  
  console.log(params);

  for (const [key, value] of Object.entries(params)) {
    fd.append(key, value);
  }

  // start point before reload and upload TYPE so

  let xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader('X-CSRF-Token', AUTH_TOKEN);
  xhr.onreadystatechange = function() {
    if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
      console.log(this.response);
      callback(JSON.parse(this.response));
    }
  }

  xhr.send(fd);
}

document.addEventListener("keydown", function (e) {
  switch (e.key) {
    case "w":
    case "W":
      keys.up = true;
      break;
    case "a":
    case "A":
      keys.left = true;
      break;
    case "s":
    case "S":
      keys.down = true;
      break;
    case "d":
    case "D":
      keys.right = true;
      break;
  };
});

document.addEventListener("keyup", function (e) {
  switch (e.key) {
    case "w":
    case "W":
      keys.up = false;
      break;
    case "a":
    case "A":
      keys.left = false;
      break;
    case "s":
    case "S":
      keys.down = false;
      break;
    case "d":
    case "D":
      keys.right = false;
      break;
    case "Enter":
      keys.interact = true;
      break;
  };
});