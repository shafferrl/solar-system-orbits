import {
    Vector2
} from 'three';


const PI = Math.PI
const PI2 = 2 * Math.PI;


function debounce( func, delay ) {

    let inDebounce;

    return function() {

        const context = this;
        const args = arguments;
        clearTimeout( inDebounce );
        inDebounce = setTimeout( () => func.apply( context, args ), delay );

    }

}


function toRadians( degrees ) {

    return degrees * PI2 / 360;
    
}


// Convert hex color to normalized decimal
function hexColorConvert( hexColor ) {

    const hexDigitToDec = {
        0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
        a: 10, b: 11, c: 12, d: 13, e: 14, f: 15
    }

    hexColor = hexColor.slice( 1, ).toLowerCase();

    let hexColorCmpnts;

    if ( hexColor.length === 3 ) {

        hexColorCmpnts = [
            [ hexColor[ 0 ], hexColor[ 0 ] ],
            [ hexColor[ 1 ], hexColor[ 1 ] ],
            [ hexColor[ 2 ], hexColor[ 2 ] ]
        ];
    }
    else {

        hexColorCmpnts = [
            hexColor.slice( 0, 2 ),
            hexColor.slice( 2, 4 ),
            hexColor.slice( 4, 6)
        ];
    }
    let hexColorDec = new Array();

    for ( let cmpnt of hexColorCmpnts ) {
        
        let cmpntDec = hexDigitToDec[ cmpnt[ 0 ] ] * 16 + hexDigitToDec[ cmpnt[ 1 ] ];
        hexColorDec.push( cmpntDec / 255  );

    }

    return hexColorDec;

}


function midpoint2D( pt1, pt2 ) {

    return new Vector2( ( pt1.x + pt2.x ) / 2, ( pt1.y + pt2.y ) / 2 );

}


function toCartesian2D( ptPolar ) { 

    return new Vector2( ptPolar.r * Math.cos( ptPolar.theta ), ptPolar.r * Math.sin( ptPolar.theta ) );

}


function toPolar2D( ptCartesian ) {

    return { r: Math.sqrt( ptCartesian.x**2 + ptCartesian.y**2 ), theta: Math.atan2( ptCartesian.y, ptCartesian.x ) };

}


function ellipseRadPolar( a, e, theta ) {

    return a * ( 1 - e**2 ) / ( 1 + e * Math.cos( theta ) );

}

// Optimize ellipse vertex distribution
function drawEllipsePolar( aModel, eModel, segNo ) {

    // Render polar ellipse unoptimized
    const ellipse0 = new Array();

    for ( let i = 0; i < parseInt( segNo / 2 ) + 1; i++ ) {

        let thetaSeg = i * PI / ( segNo / 2 );
        let refPt = { r: ellipseRadPolar( aModel, eModel, thetaSeg ), theta: thetaSeg };
        ellipse0.push( refPt );

    }
    
    // Optimize polar ellipse
    let ellipse1 = new Array( ...ellipse0 );

    // Don't optimize near-circle ellipses
    if ( eModel > 0.1 ) {

        let descentRate = 1000000;
        const diffThreshld = 0.01;

        let diffDev = 1;

        while ( diffDev > diffThreshld ) {

            diffDev = 0;

            for ( let step = 0; step < parseInt( segNo / 2 ) - 1; step ++ ) {

                const midptDevs = new Array();

                for ( let devSegmnt = step; devSegmnt < step + 2; devSegmnt ++ ) {

                    const segEndpt1 = toCartesian2D( ellipse1[ parseInt( segNo / 2 ) - devSegmnt ] );
                    const segEndpt2 = toCartesian2D( ellipse1[ parseInt( segNo / 2 ) - devSegmnt - 1 ] );

                    const segMidptPolar = toPolar2D( midpoint2D( segEndpt1, segEndpt2 ) );

                    const midptDev = ellipseRadPolar( aModel, eModel, segMidptPolar.theta ) - segMidptPolar.r;
                    midptDevs.push( midptDev );
                    
                    if ( devSegmnt == step + 1 ) {

                        const devDiff = midptDevs[ 0 ] - midptDev;
                        const deltaTheta = descentRate * devDiff;
                        const ellipseIndex = parseInt( segNo / 2 ) - devSegmnt;

                        const thetaNew = ellipse1[ ellipseIndex ].theta + deltaTheta;
                        ellipse1[ ellipseIndex ] = { r: ellipseRadPolar( aModel, eModel, thetaNew ), theta: thetaNew };

                        diffDev += devDiff;
                        
                    }

                }
            }
            
            if ( diffDev < 0 ) {

                ellipse1 = new Array( ...ellipse0 );
                descentRate *= 0.1;
                diffDev = 1;
                break;

            }
            
        }

    }
    
    const iHalf = ellipse1.length;

    for ( let iSgmnt = 0; iSgmnt < parseInt( segNo / 2 ); iSgmnt ++ ) {

        const iSelect = ellipse1.length - ( ellipse1.length - iHalf ) - 2 - iSgmnt;
        ellipse1.push( { r: ellipse1[ iSelect ].r, theta: 2 * PI - ellipse1[ iSelect ].theta } );
        
    }

    return ellipse1;

}


export {
    PI,
    PI2,
    debounce,
    toRadians,
    hexColorConvert,
    midpoint2D,
    toCartesian2D,
    toPolar2D,
    ellipseRadPolar,
    drawEllipsePolar,
}