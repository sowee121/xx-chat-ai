/**
 * Streamdown KaTeX 数学插件包装。
 */
import { createMathPlugin } from '@streamdown/math'

/** 启用 $...$ 行内公式，兼容主流模型常见 LaTeX 输出。 */
export const math = createMathPlugin({
  singleDollarTextMath: true,
})
