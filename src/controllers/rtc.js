const store = require('../store');

const AddUser = async (req, res) => {
    const room = await store.rooms.asyncInsert({
        users: [req.user.id],
    });

    res.status(200).send(room);
};

const JoinUser = async (req, res) => {
    const { id } = req.fields;
    let room;
    try {
        room = await store.rooms.asyncFindOne({ _id: id });
        if (!room.users.includes(req.user.id)) {
            await store.rooms.asyncUpdate({ _id: id }, { $push: { users: req.user.id } });
            room = await store.rooms.asyncFindOne({ _id: id });
        }
    } catch (e) {
        console.log(e);
    }
    res.status(200).json(room);
};

const GetPeers = async (req, res) => {
    const peers = await store.peers.asyncFind({});
    res.status(200).send(peers);
};


module.exports = {
    AddUser,
    GetPeers,
    JoinUser
};