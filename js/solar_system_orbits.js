import {
    BackSide,
    WebGLRenderer,
    Scene,
    AmbientLight,
    PointLight,
    PerspectiveCamera,
    Vector2,
    Vector3,
    CatmullRomCurve3,
    Group,
    BufferGeometry,
    IcosahedronGeometry,
    SphereGeometry,
    LineBasicMaterial,
    MeshBasicMaterial,
    MeshLambertMaterial,
    BufferAttribute,
    Float32BufferAttribute,
    Uint8BufferAttribute,
    LineSegments,
    LinearSRGBColorSpace,
    Mesh,
    Raycaster,
    Quaternion,
    Spherical,
    Matrix4,
    Box3,
    Sphere,
    Clock,
    TextureLoader,
    LoadingManager,
    Color
} from 'three';

import {
    PI,
    PI2,
    debounce,
    toRadians,
    hexColorConvert,
    toCartesian2D,
    ellipseRadPolar,
    drawEllipsePolar,
} from 'solar-system-orbits-utils';

import {
    defaultTexturePath,
    skyData,
    sunData,
    sunDataObject,
    solarRootAlias,
    modelScale
} from 'global-data';

import * as DOM from 'solar-system-orbits-selectors';

import { KTX2Loader } from 'ktx2-loader';
import { mergeGeometries } from 'buffergeometry-utils';
import { orbitData } from 'orbit-data';
import { LensflareScale, LensflareElement } from 'lensflare';
import CameraControls from 'camera-controls';

const subsetOfTHREE = {
    Vector2: Vector2,
    Vector3: Vector3,
    Raycaster: Raycaster,
    Spherical: Spherical,
    Quaternion: Quaternion,
    Matrix4: Matrix4,
    Box3: Box3,
    Sphere: Sphere
}

CameraControls.install( { THREE: subsetOfTHREE } );


const modelData = orbitData.model_meta;


const scene = new Scene();


const renderer = new WebGLRenderer({
    antialias: true,
    logarithmicDepthBuffer: true,
    alpha: true
});

renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );


const loadManager = new LoadingManager();

loadManager.onLoad = function() {

    DOM.loadAnimationCntnr.classList.add( 'loaded' );
    
}

const ktx2Loader = new KTX2Loader( loadManager );
ktx2Loader.setTranscoderPath( DOM.sceneScriptElement.dataset.transcoderPath );
ktx2Loader.detectSupport( renderer );

const textureLoader = new TextureLoader( loadManager );

// Texture used to show polar orientation of celestial bodies
const refDirTexture = textureLoader.load( defaultTexturePath );


const maxCamDist = 7.48e5;
const maxDrawDist = maxCamDist * 3;
const camera = new PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 0.0001, maxDrawDist );
camera.position.set( 0, 0, 1000 );

const cameraControls = new CameraControls( camera, renderer.domElement );
cameraControls.smoothTime = 0.25;
cameraControls.maxDistance = maxCamDist;
cameraControls.minDistance = 2e7 * modelScale;
cameraControls.truckSpeed = 0;

cameraControls.viewTargetObject = sunDataObject;

const sunLight = new PointLight( 0xffffff, 5000, maxDrawDist * 2, 1.0 );
const position0 = new Vector3( 0, 0, 0 );
sunLight.position.copy( position0 );
scene.add( sunLight );

const ambientLight = new AmbientLight( 0xffffff, 0.001 );
scene.add( ambientLight );


// Important Vectors
const xICRF = new Vector3( 1, 0, 0 );
const eclptcNormalICRF = new Vector3( 0, 1, 0 );
const northICRF = eclptcNormalICRF.clone().applyAxisAngle( xICRF, -toRadians( modelData.phi_icrf.value ) );
const northCrossXICRF = new Vector3().crossVectors( northICRF, xICRF );


const skyMeshes = new Array();

for ( let i = 0; i < skyData.maps.length; i ++ ) {

    const skyMesh = new Mesh(

        new SphereGeometry( 
            skyData.skyRadiusFactor  * maxDrawDist * ( 1 - i * skyData.nestInset ),
            skyData.skyGeomRes, 
            skyData.skyGeomRes / 2,
            0,                  // phi start
            PI2,                // phi length
            PI / 6,             // theta start
            4 * PI / 6          // theta length
        ),

        new MeshBasicMaterial( {
            color: "#000000",
            lightMapIntensity: skyData.skyIntensity,
            depthWrite: false
        } )
    
    );
        
    // Create second set of uvs for light map
    const uv1Array = skyMesh.geometry.getAttribute("uv").array;
    skyMesh.geometry.setAttribute( 'uv2', new BufferAttribute( uv1Array, 2 ) );
    skyMesh.material.side = BackSide;
    skyMesh.scale.z = -1;
    
    if ( skyData.maps[ i ].csys === 'glctc' ) {

        skyMesh.rotation.set( -skyData.glctcRotations.x, skyData.glctcRotations.y, -skyData.glctcRotations.z );
    
    }

    skyMesh.rotateOnWorldAxis( xICRF, - toRadians( modelData.phi_icrf.value ) );

    scene.add( skyMesh );

    skyMeshes.push( skyMesh );

    let skyIndex = scene.children.length - 1;

    ktx2Loader.load(

        `${skyData.skyPath}${skyData.maps[ i ].map }`,

        function ( texture ) {

            texture.anisotropy = 4;
            texture.colorSpace = LinearSRGBColorSpace;
            scene.children[ skyIndex ].material.color.setHex( 0xffffff );
            scene.children[ skyIndex ].material.map = texture;
            scene.children[ skyIndex ].material.lightMap = texture;
            scene.children[ skyIndex ].material.needsUpdate = true;

            renderer.render( scene, camera );
            
        }, null, 
        
        function (err) { console.log('Texture load error: ', err); }
    )

}


const sunflare = new LensflareScale();

const refDistance = camera.position.distanceTo( new Vector3( 0, 0, 0 ) );

// Populate sun flare with its elements
for ( let flareElement of sunData.flareElements ) {

    const flareTexture = textureLoader.load(
        `${ sunData.sunFlarePath }${ flareElement.texture }`,
        function( texture ) {
            renderer.render( scene, camera );
        }
    );

    sunflare.addElement( new LensflareElement(
        flareTexture,
        sunData.sunScale * flareElement.scale,  // flare element size
        0,                                      // flare element distance (from sun position)
    ));

}

sunLight.add( sunflare );

const indctrGeometry = new IcosahedronGeometry( 17, 2 );
const indctrGeometryDwarf = new IcosahedronGeometry( 13, 2 );
const indctrGeometryMinor = new IcosahedronGeometry( 10, 2 );
const indctrGeometrySatellite = new IcosahedronGeometry( 2, 2 );
const bodyGeometry = new SphereGeometry( 1, 28, 14 );

const sunSelector = new Mesh(
    indctrGeometry,
    new MeshBasicMaterial()
);
sunSelector.visible = false;
sunSelector.userData.objectInfo = sunDataObject;


function sizeSunflare() {

    sunflare.flareScale = 1 / Math.log( camera.position.distanceTo( position0 ) / refDistance + 1.1 );

}
sizeSunflare();


// Sky sphere centered around camera
function setSkyPosition( ) {

    for ( let skyMesh of skyMeshes ) {

        skyMesh.position.set( camera.position.x, camera.position.y, camera.position.z );

    }

}


const orbitGrayDefault = 1.0;
const indctrGrayDefault = 0.3125;
const orbitRGBDefault = [ orbitGrayDefault, orbitGrayDefault, orbitGrayDefault ];
const indctrRGBDefault = [ indctrGrayDefault, indctrGrayDefault, indctrGrayDefault ];

const indctrObjects = new Array();
const indctrsGroup = new Group();

indctrObjects.push( sunSelector );
indctrsGroup.add( sunSelector );

const bodiesGroup = new Group();
const bodyObjects = new Array();


const aliasConversions = {

    'Earth System': 'Earth-Moon BC', 
    'Earth-Moon Barycenter': 'Earth-Moon BC', 
    'Pluto System': 'Pluto-Charon BC', 
    'Pluto System Barycenter': 'Pluto-Charon BC', 
    '(The) Sun': 'The Sun',
    'Trans-Neptunian Object': 'TNO',
    'Main-Belt Asteroid': 'Asteroid',
    'Non-Periodic Comet': 'Comet',
    'Periodic Comet': 'Comet',
    'laplace': 'Laplace',
    'clstl_eqtr_intsct': '&#8853;&#xFE0E; Eqtr Intrsct',
    'parent_eqtr': 'Parent Equator',
    'ecliptic': 'Ecliptic',
    'icrf_equator': '&#8853;&#xFE0E; Eqtr',
    'icrf_x': '0 <span class="units">hrs</span> 0<span class="units">&deg;</span>',
    'The Moon / Luna': 'The Moon',
    'Moon': 'The Moon',
    'Inner Planet': 'Planet',
    'Outer Planet': 'Planet',

};

// Reformat names into more succinct form for readouts
function convertAlias( alias, convertMoon = true ) {


    if ( alias in aliasConversions ) {

        alias = aliasConversions[ alias ];

    }
    else if ( alias.includes( 'Moon' ) && convertMoon ) {

        alias = 'Natrl Sat';

    }

    return alias;

}


// Handling exceptional cases (i.e. barycentric/binary systems)
const orbitParentsExclude = [ 'Earth', 'Pluto', '134340 Pluto' ];
const orbitParentsInclude = [ 'Earth-Moon Barycenter', 'Pluto System Barycenter', 'Earth System', 'Pluto System' ];
const retroRotators = [ 'Pluto System Barycenter' ];


const orbitGroups = new Object();
orbitGroups[ solarRootAlias ] = { offset: new Vector3( 0, 0, 0 ), array: new Array(), vertexCount: 0 };


// Populate model with orbit, indicator, and body for each object
for ( let orbitObject in orbitData.orbit_objects ) {

    const objectInfo = orbitData.orbit_objects[ orbitObject ];
    const objectClerical = objectInfo.clerical;
    const objectOrbital = orbitData.orbit_objects[ orbitObject ].orbital;
    const objectPhysical = orbitData.orbit_objects[ orbitObject ].physical;

    const thetaJ2000 = toRadians( objectOrbital.ta.value );

    let orbitPtJ2000;

    let orbitPts = new Array();
    const orbitVertexColors = new Array();

    // Calculate vectors used for orienting and positioning orbits
    
    const apsidalVec0 = xICRF.clone();
    const apsidalVecXZ = new Vector3( objectOrbital.apsidal_vector[ 0 ], 0, -objectOrbital.apsidal_vector[ 1 ] ).normalize();

    const apsidalVecFinal = new Vector3( 
        objectOrbital.apsidal_vector[ 0 ], 
        objectOrbital.apsidal_vector[ 2 ], 
        -objectOrbital.apsidal_vector[ 1 ] 
    ).normalize();

    const orbitNormal0 = eclptcNormalICRF.clone();

    const orbitNormalVec = new Vector3(
        objectOrbital.orbit_norml_cart[ 0 ],
        objectOrbital.orbit_norml_cart[ 2 ],
        -objectOrbital.orbit_norml_cart[ 1 ], 
    ).normalize();

    const apsidalAngleXZ = Math.atan2( apsidalVecXZ.z, apsidalVecXZ.x ) >= 0 ? -apsidalVec0.angleTo( apsidalVecXZ ) : apsidalVec0.angleTo( apsidalVecXZ );

    const apsidalCross = new Vector3().crossVectors( apsidalVecXZ, apsidalVecFinal ).normalize();
    const apsidalAngleY = apsidalVecXZ.angleTo( apsidalVecFinal );

    const orbitNormal1 = orbitNormal0.clone().applyAxisAngle( apsidalCross, apsidalAngleY ).normalize();

    const normalAngle1 = orbitNormal1.angleTo( orbitNormalVec );
    const orbitNormalCross = new Vector3().crossVectors( orbitNormal1, orbitNormalVec ).normalize();

    const isSatellite = objectOrbital.orbits != solarRootAlias;

    let orbitGroupID;

    // Check whether satellite's parent already has a group and create new group if not
    if ( isSatellite ) {

        for ( let orbitGroup in orbitGroups ) {

            if ( objectOrbital.orbits === orbitGroup ) {

                orbitGroupID = orbitGroup;

            }

        }

        if ( !orbitGroupID ) {
            
            orbitGroupID = objectOrbital.orbits;
            orbitGroups[ orbitGroupID ] = { offset: null, array: new Array(), vertexCount: 0 };

        }
    
    }
    else {

        orbitGroupID = solarRootAlias;

    }

    // Set number of vertices for orbit geometry
    const geomVertNo = objectOrbital.seg_no * 2.5;

    // Calculate orbit points if only parameters given
    if ( !( 'orbit_pts' in objectInfo ) ) {

        const orbitPts2DPolar = drawEllipsePolar( modelScale * objectOrbital.a.value, objectOrbital.e.value, geomVertNo );

        const orbitPts3D = new Array();


        for ( let pt2DPolar of orbitPts2DPolar ) {
            
            const pt2DCart = toCartesian2D( pt2DPolar );
            const orbitPt = new Vector3( pt2DCart.x, 0, -pt2DCart.y );

            orbitPt.applyAxisAngle( orbitNormal0, apsidalAngleXZ );
            orbitPt.applyAxisAngle( apsidalCross, apsidalAngleY );
            orbitPt.applyAxisAngle( orbitNormalCross, normalAngle1 );
            
            orbitPts3D.push( orbitPt );

        }

        orbitPts = orbitPts3D;

    }
    // Some bodies have pre-calculated orbit points
    else {
        
        for ( let orbitPt of objectInfo.orbit_pts ) {

            orbitPt = new Vector3( orbitPt[ 0 ], orbitPt[ 2 ], -orbitPt[ 1 ] ).multiplyScalar( modelScale / modelData.model_scale );

            orbitPts.push( orbitPt );

        }

    }

    // Colors and alpha values for each object
    let objectRGB = 'color_ref_dark' in objectClerical ? hexColorConvert( objectClerical.color_ref_dark ) : orbitRGBDefault;
    let objectAlpha = objectClerical.catgry_prmry.includes( 'Planet' ) ? 0.625 : 'color_ref_dark' in objectClerical ? 0.3125 : 0.125;
    let indctrRGB = 'color_ref_dark' in objectClerical ? hexColorConvert( objectClerical.color_ref_dark ) : indctrRGBDefault;
    
    // Calculate J2000 position
    const radJ2000 = ellipseRadPolar( modelScale * objectOrbital.a.value, objectOrbital.e.value, thetaJ2000 );
    let polar2DJ2000 = { r: radJ2000, theta: thetaJ2000 };

    const cart2DJ2000 = toCartesian2D( polar2DJ2000 );

    orbitPtJ2000 = new Vector3( cart2DJ2000.x, 0, -cart2DJ2000.y );

    orbitPtJ2000.applyAxisAngle( orbitNormal0, apsidalAngleXZ );
    orbitPtJ2000.applyAxisAngle( apsidalCross, apsidalAngleY );
    orbitPtJ2000.applyAxisAngle( orbitNormalCross, normalAngle1 );

    // Set up orbit group for satellites of objects that have them
    if ( 'satellites' in objectClerical && !( orbitParentsExclude.includes( orbitObject ) ) || orbitParentsInclude.includes( orbitObject ) ) {

        orbitGroups[ orbitObject ] = { offset: orbitPtJ2000, array: new Array(), vertexCount: 0 };

    }

    // Indicator to be used on scales too large for bodies to be easily visible or selectable
    let indctrGeometry2 = objectOrbital.orbits !== solarRootAlias ? indctrGeometrySatellite : 
                            !( 'color_ref_dark' in objectClerical ) ? indctrGeometryMinor :
                            objectClerical.catgry_prmry.includes( 'Planet' ) ? indctrGeometry : indctrGeometryDwarf;

    const bodyIndctrObject = new Mesh(
        indctrGeometry2,
        new MeshBasicMaterial( {
            transparent: true,
            opacity: 1,
            color: new Color( indctrRGB[ 0 ], indctrRGB[ 1 ], indctrRGB[ 2 ] ),
            depthWrite: false,
        } )
    );
    
    bodyIndctrObject.position.copy( orbitPtJ2000 );

    // Move origin to parent starting position
    if ( isSatellite ) {
        
        bodyIndctrObject.position.add( orbitGroups[ objectOrbital.orbits ].offset );
    
    }

    objectInfo.clerical.catgry_short = objectClerical.catgry_prmry;
    bodyIndctrObject.userData.objectInfo = objectInfo;
    bodyIndctrObject.userData.orbitGroupID = orbitGroupID;

    indctrObjects.push( bodyIndctrObject );
    indctrsGroup.add( bodyIndctrObject );

    // Create physical body mesh for applicable objects
    if ( 'radius_eqtr' in objectPhysical ) {

        const bodyMesh = new Mesh(
            bodyGeometry,
            new MeshLambertMaterial( { 
                color: 0xffffff,
                map: refDirTexture
            } )
        );
        bodyMesh.position.copy( orbitPtJ2000 );
        bodyMesh.scale.multiplyScalar( modelScale * objectPhysical.radius_eqtr.value / 1e3 );
        if ( 'radius_pole' in objectPhysical ) {
            
            bodyMesh.scale.y *= objectPhysical.radius_pole.value / objectPhysical.radius_eqtr.value;

            if ( 'oblqty' in objectPhysical && objectPhysical.oblqty.value > 90 && !retroRotators.includes( objectOrbital.orbits ) || retroRotators.includes( objectOrbital.orbits ) && !( 'oblqty' in objectPhysical ) ) {

                bodyMesh.scale.multiplyScalar( -1 );

            }

        }
        if ( 'pole_ra' in objectPhysical ) {

            bodyMesh.rotateOnWorldAxis( xICRF, -toRadians( modelData.phi_icrf.value ) );
            bodyMesh.rotateOnWorldAxis( northCrossXICRF, PI / 2 - toRadians( objectPhysical.pole_dec.value ) );
            bodyMesh.rotateOnWorldAxis( northICRF, toRadians( objectPhysical.pole_ra.value ) );

        }
        else if ( objectOrbital.orbits !== solarRootAlias ) {

            const eclptcNrmlCrossOrbitNrml = new Vector3().crossVectors( eclptcNormalICRF, orbitNormalVec ).normalize();
            bodyMesh.rotateOnWorldAxis( eclptcNrmlCrossOrbitNrml, eclptcNormalICRF.angleTo( orbitNormalVec ) );

        }

        if ( isSatellite ) {
            
            bodyMesh.position.add( orbitGroups[ orbitGroupID ].offset );
        
        }
        bodyMesh.userData.objectInfo = objectInfo;
        bodyMesh.userData.orbitGroupID = orbitGroupID;

        bodyObjects.push( bodyMesh );
        bodiesGroup.add( bodyMesh );

    }
    

    const orbitCurve = new CatmullRomCurve3( orbitPts );
    const orbitCurvePts = orbitCurve.getPoints( geomVertNo );


    const orbitGeom = new BufferGeometry().setFromPoints( orbitCurvePts );
    const orbitGeomArray = orbitGeom.attributes.position.array;

    const orbitGeomArray2 = new Array();


    for ( let i = 0; i < orbitGeomArray.length / 3; i ++ ) {

        let geomPt = [ orbitGeomArray[ i * 3 ], orbitGeomArray[ i * 3 + 1 ], orbitGeomArray[ i * 3 + 2 ] ];

        orbitVertexColors.push( ...objectRGB, objectAlpha );

        if ( i !== 0 && i != orbitGeomArray.length / 3 - 1 ) {

            orbitGeomArray2.push( ...geomPt, ...geomPt );
            orbitVertexColors.push( ...objectRGB, objectAlpha );
            
        }
        else {
            orbitGeomArray2.push( ...geomPt );
        }

    }

    orbitGeom.dispose();

    bodyIndctrObject.userData.orbitVertexStart = orbitGroups[ orbitGroupID ].vertexCount;
    bodyObjects[ bodyObjects.length - 1].userData.orbitVertexStart = orbitGroups[ orbitGroupID ].vertexCount;

    orbitGroups[ orbitGroupID ].vertexCount += parseInt( orbitGeomArray2.length / 3 );

    bodyIndctrObject.userData.orbitVertexEnd = orbitGroups[ orbitGroupID ].vertexCount;
    bodyObjects[ bodyObjects.length - 1].userData.orbitVertexEnd = orbitGroups[ orbitGroupID ].vertexCount;

    const orbitGeom2 = new BufferGeometry();
    orbitGeom2.setAttribute( 'position', new Float32BufferAttribute( orbitGeomArray2, 3 ) );
    orbitGeom2.setAttribute( 'color', new Float32BufferAttribute( orbitVertexColors, 4 ) );

    orbitGroups[ orbitGroupID ].array.push( orbitGeom2 );

}

// Distance from target to fade trajectories
const targetFadeMax = 50000000.01;
const targetFadeMin = 300000.01;


const orbitMatl = new LineBasicMaterial( { 
    color: 0xffffff,
    transparent: true,
    vertexColors: true,
    depthWrite: false
} );

orbitMatl.userData.targetDistance = { value: 1.0 };

orbitMatl.onBeforeCompile = function ( shader ) {
    
    shader.vertexShader = shader.vertexShader.replace(
        `#include <common>`, /* glsl */
`attribute vec3 isSolar;
varying float vIsSolar;
varying float cameraDistance;
#include <common>`
    );

    shader.vertexShader = shader.vertexShader.replace(
        `#include <uv_vertex>`, /* glsl */
`vIsSolar = isSolar.r;
cameraDistance = distance( position, cameraPosition );
#include <uv_vertex>`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
        `uniform vec3 diffuse;`,
        `uniform vec3 diffuse;` + /* glsl */ `
uniform float targetDistance;
varying float vIsSolar;
varying float cameraDistance;
        `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
        `#include <dithering_fragment>`,
        `#include <dithering_fragment>` + /* glsl */ `
    float fadeMax = 96.0;
    float fadeMin = 48.0;
    if ( vIsSolar > 0.0 && cameraDistance < 96.0 ) gl_FragColor.a *= clamp( ( cameraDistance / ( fadeMax - fadeMin ) - ( fadeMin / ( fadeMax - fadeMin ) ) ), 0.0, 1.0 );
    if ( vIsSolar > 0.0 && cameraDistance < 48.0 ) gl_FragColor.a = 0.0;
    float targetMax = ${ targetFadeMax };
    float targetMin = ${ targetFadeMin };
    float alphaMinT = 0.0;

    if ( targetDistance < targetMax && vIsSolar > 0.0 ) gl_FragColor.a *= clamp(  ( ( 1.0 - alphaMinT ) * targetDistance / ( targetMax - targetMin ) - targetMin / ( targetMax - targetMin ) * ( 1.0 -  alphaMinT ) + alphaMinT ), alphaMinT, 1.0);
    `
    );

    shader.uniforms.targetDistance = orbitMatl.userData.targetDistance;

}


// Consolidate geometries for each system scope to reduce draw calls
for ( let orbitGroup in orbitGroups ) {

    const mergedGroupOrbitGeom = mergeGeometries( orbitGroups[ orbitGroup ].array, true );
    const mergedIsSolarArray = new Array();

    for ( let vIndex = 0; vIndex < mergedGroupOrbitGeom.attributes.position.count; vIndex++ ) {

        const isSolar = orbitGroup === solarRootAlias ? 1 : 0;
        mergedIsSolarArray.push( isSolar );

    }
    mergedGroupOrbitGeom.setAttribute( 'isSolar', new Uint8BufferAttribute( mergedIsSolarArray, 1 ) );
    const orbitCurveObject = new LineSegments( mergedGroupOrbitGeom, orbitMatl );
    orbitCurveObject.position.add( orbitGroups[ orbitGroup ].offset );
    orbitGroups[ orbitGroup ].object = orbitCurveObject;
    scene.add( orbitCurveObject );

}


const indctrsIndex = scene.children.length;
scene.add( indctrsGroup );


// Control object indicators' sizes, render sorting order, and opacity
function modulateIndctrs() {

    const cf = 1 / 120;

    const fadeThreshold = 300 / modelScale;

    const cameraTargetDist = camera.position.distanceTo( cameraControls.getTarget() ) / modelScale;
        
    orbitMatl.userData.targetDistance.value = cameraTargetDist;

    let distancedIndctrs = new Array();

    const satelliteIndctrs = new Array();
    const solarIndctrs = new Array();

    for ( let i = 0; i < indctrObjects.length; i ++ ) {

        const isSolarLevel = isSolarScoped( indctrObjects[ i ] );

        const camDist = camera.position.distanceTo( indctrObjects[ i ].position ) / modelScale;

        const distFactor = Math.pow( camDist * modelScale, 0.675 );
        indctrObjects[ i ].userData.camDist = camDist;
        let distFactorScale = distFactor * cf;

        try {

            const cameraTargetName = cameraControls.viewTargetObject.clerical.common_name;
            const indctrObjectName = indctrObjects[ i ].userData.objectInfo.clerical.common_name;
            const cameraTargetOrbits = cameraControls.viewTargetObject.orbital.orbits;
            const indctrOrbits = indctrObjects[ i ].userData.objectInfo.orbital.orbits;
    
            if ( cameraTargetDist < targetFadeMax && cameraTargetName !== indctrObjectName && cameraTargetOrbits !== indctrObjectName && indctrOrbits !== cameraTargetName && indctrOrbits === solarRootAlias ) {
    
                distFactorScale *= ( 1.0 - 0.3125 ) * cameraTargetDist / ( targetFadeMax - targetFadeMin ) - targetFadeMin / ( targetFadeMax - targetFadeMin ) * ( 1.0 -  0.3125 ) + 0.3125;     
    
            }

        } catch( err ) {}

        indctrObjects[ i ].scale.set( distFactorScale, distFactorScale, distFactorScale );

        if ( camDist < fadeThreshold ) {

            let input1 = 0.35 * ( camDist * modelScale / 5 ) - 0.05;
            const currentOpacity = isSolarLevel ? Math.max( 0, 0.4 * ( camDist * modelScale / 100 ) - 0.2 ) : 
                                    camDist < fadeThreshold / 20 ? Math.min( Math.max( 0, -input1 + 2 * Math.sqrt( input1 ) ), 1.0 ) : 1;
            indctrObjects[ i ].material.opacity = currentOpacity;

        }

        else {

            indctrObjects[ i ].material.opacity = 1;
            orbitMatl.opacity = 1;

            if ( isSolarLevel ) {
                
                solarIndctrs.push( indctrObjects[ i ] );

            }
            else {

                if ( cameraTargetDist < fadeThreshold ) {

                    indctrObjects[ i ].material.opacity = 0;

                }
                satelliteIndctrs.push( indctrObjects[ i ] );

            }

        }


        distancedIndctrs.push( indctrObjects[ i ] );

    }

    function camDistanceSort( a, b ) {

        return b.userData.camDist - a.userData.camDist;

    }

    if ( cameraTargetDist > fadeThreshold ) {

        satelliteIndctrs.sort( camDistanceSort );
        solarIndctrs.sort( camDistanceSort );

        distancedIndctrs = satelliteIndctrs.concat( ...solarIndctrs );

    }
    else {

        distancedIndctrs.sort( camDistanceSort );

    }


    for ( let i = 0; i < distancedIndctrs.length; i ++ ) {

        distancedIndctrs[ i ].renderOrder = i;

    }

}
modulateIndctrs();


const bodiesIndex = scene.children.length;
scene.add( bodiesGroup );


const raycaster = new Raycaster();
const pointer = new Vector2();

const tooltipOffsetCursor = 20;
const tooltipOffsetEdge = 2;
let tooltipXTranform;
let tooltipYTransform;

function setTooltipTransform() {

    let screenPosX = 0.5 * ( pointer.x + 1 ) * window.innerWidth ;
    let screenPosY = -0.5 * ( pointer.y - 1 ) * window.innerHeight;

    if ( screenPosX + tooltipOffsetCursor + DOM.tooltip.offsetWidth >= window.innerWidth - tooltipOffsetEdge ) {

        if ( 'ontouchstart' in document.documentElement ) {

            tooltipXTranform = window.innerWidth - tooltipOffsetEdge - DOM.tooltip.offsetWidth;

        }
        else {
            
            tooltipXTranform = screenPosX - tooltipOffsetCursor - DOM.tooltip.offsetWidth;

        }

    }
    else {

        tooltipXTranform = screenPosX + tooltipOffsetCursor;

    }

    if ( screenPosY + DOM.tooltip.offsetHeight >= window.innerHeight - tooltipOffsetEdge ) {

        tooltipYTransform = window.innerHeight - tooltipOffsetEdge - DOM.tooltip.offsetHeight;

    }
    else {

        tooltipYTransform = screenPosY;

    }

    DOM.tooltip.style.transform = `translate( ${ tooltipXTranform }px, ${ tooltipYTransform }px )`;

}


function populateTooltip( hoverObject ) {

    DOM.tooltipName.innerHTML = hoverObject.userData.objectInfo.clerical.common_name;
    DOM.tooltipCategory.innerHTML = hoverObject.userData.objectInfo.clerical.catgry_short;

}


function movePointer( event ) {

    pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

}


window.addEventListener( 'mousemove', ( e ) => {

    movePointer( e );

} );


function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.render( scene, camera );
}


window.addEventListener( 'resize', () => {

    debounce( handleResize, 150 )();
    
});


function handleFullScreenClick() {

    if ( DOM.fullscreenButton.classList.contains( 'fs' ) ) {

        document.exitFullscreen();

    }
    else {

        document.body.requestFullscreen();

    }

}


function handleFullScreenChange() {

    if ( DOM.fullscreenButton.classList.contains( 'fs' ) ) {

        DOM.fullscreenButton.classList.remove( 'fs' );

    }
    else {

        DOM.fullscreenButton.classList.add( 'fs' );

    }
}

DOM.fullscreenButton.addEventListener( 'click', handleFullScreenClick );

document.addEventListener('fullscreenchange', handleFullScreenChange, false);
document.addEventListener('mozfullscreenchange', handleFullScreenChange, false);
document.addEventListener('MSFullscreenChange', handleFullScreenChange, false);
document.addEventListener('webkitfullscreenchange', handleFullScreenChange, false);



function isSolarScoped( spaceObject ) {

    return spaceObject.userData.objectInfo.clerical.common_name === 'The Sun' || spaceObject.userData.objectInfo.orbital.orbits === solarRootAlias;

}


function indctrsRaycast() {

    raycaster.setFromCamera( pointer, camera );
    const intersects = raycaster.intersectObjects( scene.children[ indctrsIndex ].children );

    if ( intersects.length > 0 ) {

        for ( let intersect of intersects ) {

            const minSelectDistance = isSolarScoped( intersect.object ) ? 100 : 0.5;

            if ( intersect.distance > minSelectDistance ) {

                return intersect;

            }
        }

    }

    return null;

}


function bodiesRaycast() {

    raycaster.setFromCamera( pointer, camera );
    const intersects = raycaster.intersectObjects( scene.children[ bodiesIndex ].children );

    if ( intersects.length > 0 ) {

        for ( let intersect of intersects ) {

            return intersect;

        }

    }

    return null;

}


function getTopRaycast() {
    
    const bodyRaycast = bodiesRaycast();
    const indctrRaycast = indctrsRaycast();

    if ( bodyRaycast && indctrRaycast ) {

        let topRaycast = bodyRaycast.distance < indctrRaycast.distance ? bodyRaycast : indctrRaycast;
        return topRaycast;

    }
    else if ( bodyRaycast ) {

        return bodyRaycast;

    }
    else if ( indctrRaycast ) {

        return indctrRaycast;

    }
    return null;

}


function canvasHoverhandler() {

    setTooltipTransform();
    const topHover = getTopRaycast();

    if ( topHover ) {

        renderer.domElement.classList.add( 'object-hover' );
        populateTooltip( topHover.object );
        DOM.tooltip.classList.add( 'visible' );

    }
    else {

        renderer.domElement.classList.remove( 'object-hover' );
        DOM.tooltip.classList.remove( 'visible' );

    }

}


function formatAndSetDistanceReadout() {

    const targetDistance = camera.position.distanceTo( cameraControls.getTarget() ) / modelScale;
    
    let targetAltitude;

    try {

        targetAltitude = targetDistance - cameraControls.viewTargetObject.physical.radius_eqtr.value / 1e3;

    }
    catch( err ) {

        targetAltitude = targetDistance;

    }

    let formattedDistance;
    let unitPrefix = '';

    if ( targetAltitude / 1e9 > 1 ) {

        formattedDistance = ( targetAltitude / 1e9 ).toFixed( 2 );
        unitPrefix = 'B';
    }
    else if ( targetAltitude / 1e6 > 1 && targetAltitude / 1e9 < 1 ) {
        
        formattedDistance = ( targetAltitude / 1e6 ).toFixed( 2 );
        unitPrefix = 'M';

    }
    else if ( targetAltitude / 1e3 > 1 ) {
        
        formattedDistance = targetAltitude.toFixed( 0 );
        formattedDistance = formattedDistance.slice( 0 , formattedDistance.length - 3 ) + ',' + formattedDistance.slice( formattedDistance.length - 3, );
    
    }
    else {
        formattedDistance = targetAltitude.toFixed( 0 );
    }

    DOM.distanceReadoutValue.innerHTML = formattedDistance;
    DOM.distanceReadoutUnits.innerHTML = unitPrefix + 'km';

}
formatAndSetDistanceReadout();


const prevOrbitSelect = { orbitGroup: null, vertexStart: null, vertexEnd: null, alpha: null };


function populateClickReadouts() {

    try {

        const targetObject = cameraControls.viewTargetObject;
        
        DOM.nameReadout.innerHTML = convertAlias( targetObject.clerical.common_name, false );
        DOM.categoryReadout.innerHTML = convertAlias( targetObject.clerical.catgry_short );
        DOM.orbitsReadout.innerHTML = convertAlias( targetObject.orbital.orbits );
        DOM.referencePlaneReadout.innerHTML = convertAlias( targetObject.orbital.i.ref_plane );
        DOM.referenceDirReadout.innerHTML = convertAlias( targetObject.orbital.om.ref_dir );
        DOM.semiMajorReadoutValue.innerHTML = targetObject.orbital.a.value.toExponential( 3 );
        DOM.semiMajorReadoutUnits.innerHTML = targetObject.orbital.a.units;
        DOM.eccentricityReadout.innerHTML = targetObject.orbital.e.value.toFixed( 4 );
        DOM.inclinationReadoutValue.innerHTML = targetObject.orbital.i.value.toFixed( 2 );
        DOM.inclinationReadoutUnits.innerHTML = targetObject.orbital.i.units;
        DOM.ascendingNodeReadoutValue.innerHTML = targetObject.orbital.om.value.toFixed( 1 );
        DOM.ascendingNodeReadoutUnits.innerHTML = targetObject.orbital.om.units;
        DOM.periArgumentReadoutValue.innerHTML = targetObject.orbital.w.value.toFixed( 1 );
        DOM.periArgumentReadoutUnits.innerHTML = targetObject.orbital.w.units;
        DOM.trueAnomalyReadoutValue.innerHTML = targetObject.orbital.ta.value.toFixed( 2 );
        DOM.trueAnomalyReadoutUnits.innerHTML = targetObject.orbital.ta.units;

    }
    catch ( err ) {

        DOM.nameReadout.innerHTML = 'The Sun';
        DOM.categoryReadout.innerHTML = 'G-Type Star';
        DOM.orbitsReadout.innerHTML = 'N/A';
        DOM.referencePlaneReadout.innerHTML = 'N/A';
        DOM.referenceDirReadout.innerHTML = 'N/A';
        DOM.semiMajorReadoutValue.innerHTML = 'N/A';
        DOM.semiMajorReadoutUnits.innerHTML = '';
        DOM.eccentricityReadout.innerHTML = 'N/A';
        DOM.inclinationReadoutValue.innerHTML = 'N/A';
        DOM.inclinationReadoutUnits.innerHTML = '';
        DOM.ascendingNodeReadoutValue.innerHTML = 'N/A';
        DOM.ascendingNodeReadoutUnits.innerHTML = '';
        DOM.periArgumentReadoutValue.innerHTML = 'N/A';
        DOM.periArgumentReadoutUnits.innerHTML = '';
        DOM.trueAnomalyReadoutValue.innerHTML = 'N/A';
        DOM.trueAnomalyReadoutUnits.innerHTML = '';

    }

}


function canvasClickHandler() {

    const clickRaycast = getTopRaycast();

    if ( clickRaycast ) {

        const clickObject = clickRaycast.object;

        cameraControls.viewTargetObject = clickObject.userData.objectInfo;
        cameraControls.minDistance = !orbitParentsInclude.includes( cameraControls.viewTargetObject.clerical.common_name ) ?
                                        cameraControls.viewTargetObject.physical.radius_eqtr.value * 3e-5 * modelScale * 100 :
                                        5e4 * modelScale;

        const prevTargetVec = camera.position.clone().sub( cameraControls.getTarget() );

        const startVec = prevTargetVec.length() < cameraControls.minDistance ?
                        cameraControls.getTarget().clone().add( prevTargetVec.clone().multiplyScalar( cameraControls.minDistance / prevTargetVec.length() ) ) : 
                        camera.position.clone();

        const camAdd = clickObject.position.clone().sub( cameraControls.getTarget() );
        const newCamPos = startVec.clone().add( camAdd );

        cameraControls.setLookAt( 
            newCamPos.x, newCamPos.y, newCamPos.z, 
            clickObject.position.x, clickObject.position.y, clickObject.position.z, 
            true 
        );

        populateClickReadouts();


        if ( prevOrbitSelect.orbitGroup ) {

            const groupArray = Array.from( orbitGroups[ prevOrbitSelect.orbitGroup ].object.geometry.attributes.color.array );
            const resetVertexStart = prevOrbitSelect.vertexStart;
            const resetVertexEnd = prevOrbitSelect.vertexEnd;

            for ( let i = resetVertexStart; i < resetVertexEnd; i ++ ) {

                groupArray[ i * 4 + 3 ] = prevOrbitSelect.alpha;

            }

            orbitGroups[ prevOrbitSelect.orbitGroup ].object.geometry.setAttribute( 'color', new Float32BufferAttribute( groupArray, 4 ) );

        }

        try {

            const attrArray = Array.from( orbitGroups[ clickObject.userData.orbitGroupID ].object.geometry.attributes.color.array );
            const vertexStart = clickObject.userData.orbitVertexStart;
            const vertexEnd = clickObject.userData.orbitVertexEnd;
    
            prevOrbitSelect.orbitGroup = clickObject.userData.orbitGroupID;
            prevOrbitSelect.vertexStart = vertexStart;
            prevOrbitSelect.vertexEnd = vertexEnd;
            prevOrbitSelect.alpha = attrArray[ vertexStart * 4 + 3 ];
    
    
            for ( let i = vertexStart; i < vertexEnd; i ++ ) {
                
                attrArray[ i * 4 + 3 ] = 0.875;
            
            }
            
            orbitGroups[ clickObject.userData.orbitGroupID ].object.geometry.setAttribute( 'color', new Float32BufferAttribute( attrArray, 4 ) );

        }
        catch( err ) {}


    }

}


renderer.domElement.addEventListener( 'mousemove', ( ) => {

    canvasHoverhandler();

} );


// Prevent unwanted target changes due to mousedown-drag events
let isClick = false;
let clickTimeout;

function clickStartHandler() {

    isClick = true;
    clickTimeout = setTimeout( () => { isClick = false; }, 250 );
    
}

function clickStopHandler() {

    clearTimeout( clickTimeout );
    if ( isClick ) {

        isClick = false;
        canvasClickHandler();

    }

}

function clickLeaveHandler() {

    clearTimeout( clickTimeout );
    isClick = false;

}


if ( 'ontouchstart' in document.documentElement ) {

    tooltip.style.display = 'none';

    renderer.domElement.addEventListener( 'click', () => {
    
        canvasClickHandler();
    
    } );

}
else {

    renderer.domElement.addEventListener( 'mousedown', () => {
    
        clickStartHandler();
    
    } );
    
    renderer.domElement.addEventListener( 'mouseup', () => {
    
        clickStopHandler();
    
    } );
    
    renderer.domElement.addEventListener( 'mouseleave', () => {
        
        clickLeaveHandler()
    
    } );

}


const clock = new Clock();

renderer.render( scene, camera );

function animate() {

    const dt = clock.getDelta();
    requestAnimationFrame( animate );

    const cameraUpdate = cameraControls.update( dt );

    if ( cameraUpdate ) {

        setSkyPosition();
        sizeSunflare();
        modulateIndctrs();
        formatAndSetDistanceReadout();

        // No tooltip for touchscreens
        if ( !( 'ontouchstart' in document.documentElement ) ) {

            canvasHoverhandler();

        }

        renderer.render( scene, camera );

    }

}

animate();