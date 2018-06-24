// compears versionOne agesnt versionTwo, if gt then returns 1, if lt returns -1, if et then returns 0
function versionCompare(versionOne,versionTwo) {
    const version_parts_one = versionOne.split('.')
    const version_parts_two = versionTwo.split('.')
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
        if (version_parts[0] > lastest[0] ||
            version_parts[0] == lastest[0] && version_parts[1] > lastest[1] ||
            version_parts[0] == lastest[0] && version_parts[1] == lastest[1] && version_parts[2] > lastest[2]) {
                lastest=version_parts
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

module.exports = {
    compare:versionCompare,
    range:versionRange,
    max:versionMax,
    min:versionMin
}