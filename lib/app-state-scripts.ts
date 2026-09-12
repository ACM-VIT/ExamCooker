export const RELEASE_LOCK_SCRIPT = "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end";

export const RECORD_FEEDBACK_SCRIPT = `
local voteKey = KEYS[1]
local feedbackKey = KEYS[2]
local nextVote = ARGV[1]
local updatedAt = ARGV[2]
local ttlSeconds = tonumber(ARGV[3])
local previousVote = redis.call("GET", voteKey)
local upvotes = tonumber(redis.call("HGET", feedbackKey, "upvotes") or "0")
local downvotes = tonumber(redis.call("HGET", feedbackKey, "downvotes") or "0")

if previousVote == nextVote then
  return { previousVote or "", tostring(upvotes), tostring(downvotes) }
end

redis.call("SET", voteKey, nextVote, "EX", ttlSeconds)

if previousVote == "up" then
  upvotes = math.max(upvotes - 1, 0)
elseif previousVote == "down" then
  downvotes = math.max(downvotes - 1, 0)
end

if nextVote == "up" then
  upvotes = upvotes + 1
else
  downvotes = downvotes + 1
end

redis.call(
  "HSET",
  feedbackKey,
  "updatedAt",
  updatedAt,
  "upvotes",
  upvotes,
  "downvotes",
  downvotes
)
redis.call("EXPIRE", feedbackKey, ttlSeconds)

return { previousVote or "", tostring(upvotes), tostring(downvotes) }
`;

export const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call("ZREMRANGEBYSCORE", key, 0, now - window)
local count = redis.call("ZCARD", key)

if count >= limit then
  redis.call("PEXPIRE", key, window)
  return {0, count}
end

redis.call("ZADD", key, now, member)
redis.call("PEXPIRE", key, window)
return {1, count + 1}
`;
