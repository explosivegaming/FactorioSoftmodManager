// compears versionOne agesnt versionTwo, if gt then returns 1, if lt returns -1, if et then returns 0
function versionCompare(versionOne,versionTwo,special) {
    const version_parts_one = versionOne.split('.')
    const version_parts_two = versionTwo.split('.')
    switch (special) {
        case '^': {
            if (version_parts_one[0] > version_parts_two[0] ||
                version_parts_one[0] == version_parts_two[0] && version_parts_one[1] >= version_parts_two[1]) {
                    return 1
            } else return 0
        }
        case '~': {
            if (version_parts_one[0] == version_parts_two[0] && 
                version_parts_one[1] >= version_parts_two[1]-2 &&
                version_parts_one[1] <= version_parts_two[1]+2) {
                    return 1
            } else return 0
        }
        default: {
            // greater than test
            if (version_parts_one[0] > version_parts_two[0] ||
                version_parts_one[0] == version_parts_two[0] && version_parts_one[1] > version_parts_two[1] ||
                version_parts_one[0] == version_parts_two[0] && version_parts_one[1] == version_parts_two[1] && version_parts_one[2] > version_parts_two[2]) {
                    return 1
            // equle to test
            } else if (
                version_parts_one[0] == version_parts_two[0] &&
                version_parts_one[1] == version_parts_two[1] &&
                version_parts_one[2] == version_parts_two[2]) {
                    return 0
            } else return -1 // less than
        }
    }
}

// returns boolean based on if the version is in range (non inclusive)
function versionRange(version,min,max) {
    return (versionCompare(version,min) > 0 && versionCompare(version,max) < 0)
}

// returns the largest version in an array
function versionMax(tbl) {
    let latest = [0,0,0]
    for (i=0; i < tbl.length; i++) {
        const version_parts = tbl[i].split('.')
        // greater than test, same as above but uses the same compear each time
        if (version_parts[0] > latest[0] ||
            version_parts[0] == latest[0] && version_parts[1] > latest[1] ||
            version_parts[0] == latest[0] && version_parts[1] == latest[1] && version_parts[2] > latest[2]) {
                latest=version_parts
        }
    }
    return latest.join('.')
}

// returns the lowest version in an array
function versionMin(tbl) {
    let least = [0,0,0]
    for (i=0; i < tbl.length; i++) {
        const version_parts = tbl[i].split('.')
        // greater than test, same as above but uses the same compear each time
        if (version_parts[0] > least[0] ||
            version_parts[0] == least[0] && version_parts[1] < least[1] ||
            version_parts[0] == least[0] && version_parts[1] == least[1] && version_parts[2] < least[2]) {
                least=version_parts
        }
    }
    return least.join('.')
}

function testVersion(tests,parts,offset) {
    const partVersion = `${parts[offset+1]}.${parts[offset+2]}.${parts[offset+3]}`
    switch (parts[offset]) {
        case '<': tests.push(value => versionCompare(value,partVersion) < 0); break
        case '<=': tests.push(value => versionCompare(value,partVersion) <= 0); break
        case '>': tests.push(value => versionCompare(value,partVersion) > 0); break
        case '>=': tests.push(value => versionCompare(value,partVersion) >= 0); break
        case '^': tests.push(value => versionCompare(value,partVersion,'^') > 0); break
        case '~': tests.push(value => versionCompare(value,partVersion,'~') > 0); break
        case '': tests.push(value => versionCompare(value,partVersion) == 0); break
        case undefined: break
    }
}

function versionMatch(options,match,latest) {
    const version_parts = match.match(/(\*)|(?:(\??(?=[<>^~\d]))([<>^~]?=?(?=\d))(\d+)\.(\d+)\.(\d+)([<>^~]?=?(?=\d))(\d+)\.(\d+)\.(\d+)?)|(?:(\??(?=[<>^~\d]))([<>^~]?=?(?=\d))(\d+)\.(\d+)\.(\d+))/)
    if (!version_parts) {new Error('Could not parse version query');return}
    if (version_parts[1]) {
        if (latest) return versionMax(options)
        else return options
    }
    let tests = []
    testVersion(tests,version_parts,3)
    testVersion(tests,version_parts,7)
    testVersion(tests,version_parts,12)
    const found = options.filter(value => {
        for (let i = 0; i < tests.length; i++) {
            if (!tests[i](value)) return false
        }
        return true
    })
    if (latest) return versionMax(found)
    else return found
}

function extractVersion(name,includeName) {
    let moduleName = name
    let moduleVersion = '*'
    if (name.lastIndexOf('_') > 0) {moduleName = name.substring(0,name.lastIndexOf('_')); moduleVersion = name.substring(name.lastIndexOf('_')+1)}
    else if (name.lastIndexOf('@') > 0) {moduleName = name.substring(0,name.lastIndexOf('@')); moduleVersion = name.substring(name.lastIndexOf('@')+1)}
    if (includeName) return [moduleName,moduleVersion]
    else return moduleVersion
}

module.exports = {
    compare:versionCompare,
    range:versionRange,
    max:versionMax,
    min:versionMin,
    match: versionMatch,
    extract: extractVersion
}