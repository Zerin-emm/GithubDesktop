import { GitProgressParser } from './git'

/**
 * Highly approximate (some would say outright inaccurate) division
 * of the individual progress reporting steps in a fetch operation
 */
const steps = [
  { title: "远程: 压缩对象", weight: 0.1 },
  { title: "接收对象", weight: 0.7 },
  { title: "解决增量", weight: 0.2 },
]

/**
 * A utility class for interpreting the output from `git fetch --progress`
 * and turning that into a percentage value estimating the overall progress
 * of the fetch.
 */
export class FetchProgressParser extends GitProgressParser {
  public constructor() {
    super(steps)
  }
}
