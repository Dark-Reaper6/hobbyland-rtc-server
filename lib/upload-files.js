const axios = require("axios");

module.exports = async (pairs) => {
    try {
        const { data } = await axios.post(`${process.env.MAIN_SERVER_HOST}/api/S3/signed-url`, { file_keys: pairs.map(pair => pair.key) })
        const fileUrls = [];
        for (let [index, url] of data.signed_urls.entries()) {
            const currentFile = pairs[index];
            await axios.put(url, currentFile.file)
            fileUrls.push('/' + currentFile.key);
        }
        return fileUrls;
    } catch (error) { console.log(error); }
}