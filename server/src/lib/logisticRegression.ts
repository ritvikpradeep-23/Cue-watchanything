/**
 * Minimal full-batch gradient-descent binary logistic regression — the actual spec called for
 * scikit-learn in a separate Python/Render cron environment, but this app has neither Render
 * nor a Python runtime anywhere in its stack (it's Vercel + Node/Express). Rather than adding
 * an ML dependency to a Node project or standing up infrastructure that doesn't exist, this is
 * a from-scratch implementation of the same algorithm — L2-regularized logistic regression fit
 * by gradient descent, small enough (~22 features, a few thousand rows at most) that this is
 * plenty fast without a library. No dependency added to the main app either way (see spec
 * section 7) — this only ever runs from the standalone training script.
 */

export interface LogisticRegressionResult {
  /** one coefficient per feature column, same order as the input matrix */
  coefficients: number[];
  /** fit but deliberately NOT persisted to learned_weights — scoreTitle's weighted-sum scoring
   * has no bias/constant term, so only the per-feature coefficients are meaningful to save
   * (matches the spec's own `dict(zip(FEATURE_CATEGORIES, model.coef_[0]))`, which likewise
   * drops sklearn's separately-stored intercept_). */
  intercept: number;
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

export function trainLogisticRegression(
  X: number[][],
  y: number[],
  opts: { epochs?: number; learningRate?: number; l2?: number } = {},
): LogisticRegressionResult {
  const { epochs = 2000, learningRate = 0.2, l2 = 0.01 } = opts;
  const n = X.length;
  const d = X[0]?.length ?? 0;
  const weights = new Array(d).fill(0);
  let bias = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(d).fill(0);
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      let z = bias;
      for (let j = 0; j < d; j++) z += X[i][j] * weights[j];
      const error = sigmoid(z) - y[i];
      for (let j = 0; j < d; j++) gradW[j] += error * X[i][j];
      gradB += error;
    }
    for (let j = 0; j < d; j++) {
      weights[j] -= learningRate * (gradW[j] / n + l2 * weights[j]);
    }
    bias -= learningRate * (gradB / n);
  }

  return { coefficients: weights, intercept: bias };
}

export function predictProba(x: number[], model: LogisticRegressionResult): number {
  let z = model.intercept;
  for (let j = 0; j < x.length; j++) z += x[j] * model.coefficients[j];
  return sigmoid(z);
}

/** Fraction of predictions on the given (held-out) set that land on the correct side of 0.5. */
export function accuracy(X: number[][], y: number[], model: LogisticRegressionResult): number {
  if (X.length === 0) return 0;
  let correct = 0;
  for (let i = 0; i < X.length; i++) {
    const predicted = predictProba(X[i], model) >= 0.5 ? 1 : 0;
    if (predicted === y[i]) correct++;
  }
  return correct / X.length;
}
