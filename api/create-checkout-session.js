module.exports = async (req, res) => {
  return res.status(200).json({ teste: "versao-nova-rodando", agora: new Date().toISOString() });
};
