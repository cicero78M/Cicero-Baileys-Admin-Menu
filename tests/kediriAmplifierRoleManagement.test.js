import { jest } from '@jest/globals';
const find = jest.fn();
const create = jest.fn();
const setRole = jest.fn();
const update = jest.fn();
jest.unstable_mockModule('../src/model/userModel.js', () => ({
  findUserById: find, createUser: create, setKediriAmplifierRole: setRole,
  updateUser: update, getUsersByClient: jest.fn(), getUsersByClientAndRole: jest.fn(),
  getUsersByDirektorat: jest.fn(),
}));
jest.unstable_mockModule('../src/service/clientService.js', () => ({ findClientById: jest.fn() }));
const controller = await import('../src/controller/userController.js');
const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const operator = { role: 'operator', client_id: 'OTHER', client_ids: ['other', 'kediri'] };
beforeEach(() => { jest.clearAllMocks(); find.mockResolvedValue({ user_id: '1', client_id: 'KEDIRI', operator: true }); setRole.mockResolvedValue(1); });
test('add amplifier to an existing dual role user without removing operator', async () => {
  const response = res();
  await controller.createUser({ user: operator, body: { user_id: '1', client_id: 'KEDIRI', roles: ['amplifier'] } }, response, jest.fn());
  expect(setRole).toHaveBeenCalledWith('1', 'KEDIRI', true);
  expect(update).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});
test.each([true, false])('explicit amplifier=%s updates only that role', async (value) => {
  await controller.updateUser({ user: operator, params: { id: '1' }, body: { amplifier: value } }, res(), jest.fn());
  expect(setRole).toHaveBeenCalledWith('1', 'KEDIRI', value);
  expect(update).not.toHaveBeenCalled();
});
test('deny role changes without client scope or for other client', async () => {
  const response = res();
  await controller.updateUser({ user: { role: 'operator', client_id: 'OTHER', client_ids: ['OTHER'] }, params: { id: '1' }, body: { amplifier: true } }, response, jest.fn());
  expect(response.status).toHaveBeenCalledWith(403);
  find.mockResolvedValue({ user_id: '1', client_id: 'OTHER' });
  const response2 = res();
  await controller.updateUser({ user: operator, params: { id: '1' }, body: { amplifier: true } }, response2, jest.fn());
  expect(response2.status).toHaveBeenCalledWith(403);
  expect(setRole).not.toHaveBeenCalled();
});
test('reject mixed amplifier and operator updates and bulk replacement', async () => {
  const response = res();
  await controller.updateUser({ user: operator, params: { id: '1' }, body: { amplifier: true, operator: false } }, response, jest.fn());
  expect(response.status).toHaveBeenCalledWith(400);
  const bulk = res();
  await controller.updateUserRoles({ user: operator, params: { id: '1' }, body: { roles: ['amplifier'] } }, bulk, jest.fn());
  expect(bulk.status).toHaveBeenCalledWith(400);
  expect(setRole).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});
test('new KEDIRI user can explicitly have amplifier without operator', async () => {
  find.mockResolvedValue(null); create.mockResolvedValue({ user_id: '2' });
  await controller.createUser({ user: operator, body: { user_id: '2', client_id: 'KEDIRI', roles: ['amplifier'] } }, res(), jest.fn());
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ amplifier: true, client_id: 'KEDIRI' }));
  expect(create.mock.calls[0][0]).not.toHaveProperty('operator');
});
test('legacy generic update cannot modify a KEDIRI user from another tenant', async () => {
  const response = res();
  await controller.updateUser({ user: { role: 'operator', client_id: 'OTHER' }, params: { id: '1' }, body: { operator: false } }, response, jest.fn());
  expect(response.status).toHaveBeenCalledWith(403);
  expect(update).not.toHaveBeenCalled();
});
test('legacy generic update cannot move an amplifier across clients', async () => {
  const response = res();
  await controller.updateUser({ user: operator, params: { id: '1' }, body: { client_id: 'OTHER' } }, response, jest.fn());
  expect(response.status).toHaveBeenCalledWith(403);
  expect(update).not.toHaveBeenCalled();
});
test('legacy creation cannot create in KEDIRI from another tenant', async () => {
  const response = res();
  await controller.createUser({ user: { role: 'operator', client_id: 'OTHER' }, body: { user_id: '1', client_id: 'KEDIRI' } }, response, jest.fn());
  expect(response.status).toHaveBeenCalledWith(403);
  expect(create).not.toHaveBeenCalled();
});
test('does not silently ignore an additional operator grant on existing user', async () => {
  find.mockResolvedValue({ user_id: '1', client_id: 'KEDIRI', operator: false });
  const response = res();
  await controller.createUser({ user: operator, body: { user_id: '1', client_id: 'KEDIRI', roles: ['operator', 'amplifier'] } }, response, jest.fn());
  expect(response.status).toHaveBeenCalledWith(400);
  expect(setRole).not.toHaveBeenCalled();
});
