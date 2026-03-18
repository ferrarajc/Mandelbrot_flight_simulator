export const MANDELBROT_SHADER = `
uniform float2 resolution;
uniform float2 center;
uniform float zoom;

half4 main(float2 fragCoord) {
    float scale = zoom * resolution.y * 0.5;
    float2 c = (fragCoord - resolution * 0.5) / scale + center;

    float2 z = float2(0.0, 0.0);
    int iter = 200;

    for (int i = 0; i < 200; i++) {
        float x2 = z.x * z.x;
        float y2 = z.y * z.y;
        if (x2 + y2 > 4.0) {
            iter = i;
            break;
        }
        z = float2(x2 - y2 + c.x, 2.0 * z.x * z.y + c.y);
    }

    if (iter == 200) {
        return half4(0.0, 0.0, 0.0, 1.0);
    }

    // Smooth iteration count (eliminates banding)
    float nu = log2(log2(dot(z, z)) * 0.5);
    float t = (float(iter) + 1.0 - nu) / 200.0;

    // Cosine color palette
    half r = half(0.5 + 0.5 * cos(6.2832 * (t * 3.0 + 0.0)));
    half g = half(0.5 + 0.5 * cos(6.2832 * (t * 3.0 + 0.333)));
    half b = half(0.5 + 0.5 * cos(6.2832 * (t * 3.0 + 0.667)));
    return half4(r, g, b, 1.0);
}
`;
