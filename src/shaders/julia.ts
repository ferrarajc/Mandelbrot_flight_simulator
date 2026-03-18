export const JULIA_SHADER = `
uniform float2 resolution;
uniform float2 c;
uniform float zoom;

half4 main(float2 fragCoord) {
    float scale = zoom * resolution.y * 0.5;
    float2 z = (fragCoord - resolution * 0.5) / scale;

    int escaped = 0;
    int iter = 0;

    for (int i = 0; i < 150; i++) {
        float x2 = z.x * z.x;
        float y2 = z.y * z.y;
        if (x2 + y2 > 4.0 && escaped == 0) {
            escaped = 1;
            iter = i;
        }
        if (escaped == 0) {
            z = float2(x2 - y2 + c.x, 2.0 * z.x * z.y + c.y);
        }
    }

    if (escaped == 0) {
        return half4(0.0, 0.0, 0.0, 1.0);
    }

    float t = float(iter) / 150.0;
    half r = half(0.5 + 0.5 * cos(6.2832 * (t + 0.0)));
    half g = half(0.5 + 0.5 * cos(6.2832 * (t + 0.333)));
    half b = half(0.5 + 0.5 * cos(6.2832 * (t + 0.667)));
    return half4(r, g, b, 1.0);
}
`;
