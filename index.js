import { opendir, readFile, writeFile } from 'node:fs/promises'
import { process_raw_results, score_run } from './process-wpt-results.js'

async function read_json_file (path) {
    const contents = await readFile(path, {
        encoding: 'utf8'
    })
    return JSON.parse(contents)
}

async function write_json_file (path, json) {
    const contents = JSON.stringify(json)
    return writeFile(path, contents)
}

async function find_latest_run () {
    const dir = await opendir('./runs')
    const runs = []
    for await (const run of dir) {
        runs.push(run.name)
    }

    runs.sort()
    console.log(runs)
    return await read_json_file(`./runs/${runs[runs.length - 1]}`)
}

async function main () {
    const mode = process.argv[2]
    if (!['--add', '--recalc'].includes(mode)) {
        throw new Error(`invalid mode specified: ${mode}`)
    }

    let new_run
    if (mode === '--add') {
        const filename = process.argv[3]
        const date = process.argv[4]
        const matches = process.argv[5].match(/Servo ([0-9.]+-[a-f0-9]+)?(-dirty)?$/)
        let servo_version = 'Unknown'
        if (matches) {
            servo_version = matches[1]
        }

        const results = await read_json_file(filename)
        new_run = process_raw_results(results)
        new_run.run_info.browser_version = servo_version
        await write_json_file(`./runs/${date}.json`, new_run)
    } else if (mode === '--recalc') {
        new_run = await find_latest_run()
    }

    const scores = []
    const dirs = await opendir('./runs')
    for await (const dir of dirs) {
        const [date] = dir.name.split('.')
        const run = await read_json_file(`./runs/${dir.name}`)
        const score = score_run(run, new_run)
        scores.push([
            date,
            score,
            run.run_info.revision.substring(0, 6),
            run.run_info.browser_version
        ])
    }

    write_json_file('./site/scores.json', { scores })
}

main()
