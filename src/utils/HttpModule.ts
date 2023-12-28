import * as https from 'https';

/**
 * Common http request function
 * @param url endpoint url
 * @param data POST data
 * @param options https request options
 * @returns a promise of Buffer
 */
export const sendHttpRequest = async(url: string, data: any, options: https.RequestOptions): Promise<Buffer> => {
    return new Promise<Buffer>((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                });
                res.on('end', () => {
                    const responseBody = Buffer.concat(chunks);
                    resolve(responseBody);
                });
            } else {
                reject(
                    new Error(`HTTP request failed with status code ${res.statusCode}`)
                );
            }
        });

        req.on('error', (error: Error) => {
            reject(error);
        });

        if (data) {
            req.write(data);
        }

        req.end((error) => {
            if (error) {
                reject(error);
            }
        });
    });
}
