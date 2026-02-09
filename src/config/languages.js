/**
 * @fileoverview Supported Languages Configuration
 * 
 * Contains the list of supported languages with their display names 
 * and flag icons for the language selector.
 */

const LANGUAGES = [
    { "name": "English (IN)", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.6407552849127816-1732870612423.png" },
    { "name": "Hindi", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.6407552849127816-1732870612423.png" },
    { "name": "Marathi", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.6407552849127816-1732870612423.png" },
    { "name": "Gujarati", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.6407552849127816-1732870612423.png" },
    { "name": "Malayalam", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.6407552849127816-1732870612423.png" },
    { "name": "Tamil", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.6407552849127816-1732870612423.png" },
    { "name": "Telugu", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.6407552849127816-1732870612423.png" },
    { "name": "Urdu", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.6407552849127816-1732870612423.png" },
    { "name": "Arabic", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.5683194480717881-1732878984366.jpg" },
    { "name": "Chinese", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.9722954366024594-1732876216228.png" },
    { "name": "Spanish", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.4771612376845238-1732878261030.png" },
    { "name": "French", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.7404369069177423-1732878162789.png" },
    { "name": "German", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.413777746668861-1732877934981.png" },
    { "name": "Russian", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.8216443374656774-1732877827441.png" },
    { "name": "Italian", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.9532484524761495-1732877759098.png" },
    { "name": "Indonesian", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.8911968685628548-1733113600412.png" },
    { "name": "Korean", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.9427068072727796-1733113629781.png" },
    { "name": "Hebrew", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.6388368028242402-1733113696672.png" },
    { "name": "Dutch", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.3183218883630936-1733113764665.png" },
    { "name": "Polish", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.6920747261778075-1733113855412.png" },
    { "name": "Danish", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.4967450305478682-1733113917612.png" },
    { "name": "Swedish", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.007779654785072365-1733113961419.png" },
    { "name": "Turkish", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.588575429207939-1733114051331.png" },
    { "name": "Portuguese", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.28944340281008674-1733114105330.png" },
    { "name": "Czech", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.810582609207481-1733114266011.png" },
    { "name": "Portuguese (BR)", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.07435228321668519-1733114334767.png" },
    { "name": "Finnish", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.6684993068132175-1733114406213.png" },
    { "name": "Greek", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.8462945105919195-1733114455796.png" },
    { "name": "Hungarian", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.4193755301721305-1733114718683.jpg" },
    { "name": "Thai", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.5081577918650666-1734334659004.png" },
    { "name": "Bulgarian", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.913978277476591-1733114881873.png" },
    { "name": "Malay", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.05188326701593571-1733114864720.png" },
    { "name": "Slovenian", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.03962132062258128-1733114806470.png" },
    { "name": "Ukrainian", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.37307904559820826-1733114787346.png" },
    { "name": "Croatian", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.492679905094078-1733114763762.png" },
    { "name": "Romania", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.35571138457848983-1733114746656.png" },
    { "name": "Japanese", "flag": "https://zipaworld.s3.ap-south-1.amazonaws.com/unTracked/s3Bucketoo0.40422567309313995-1733114911027.png" }
];

export default LANGUAGES;