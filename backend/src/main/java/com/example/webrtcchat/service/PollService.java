package com.example.webrtcchat.service;

import com.example.webrtcchat.entity.PollEntity;
import com.example.webrtcchat.entity.PollOptionEntity;
import com.example.webrtcchat.entity.PollVoteEntity;
import com.example.webrtcchat.repository.PollRepository;
import com.example.webrtcchat.repository.PollVoteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PollService {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private final PollRepository pollRepository;
    private final PollVoteRepository pollVoteRepository;

    public PollService(PollRepository pollRepository, PollVoteRepository pollVoteRepository) {
        this.pollRepository = pollRepository;
        this.pollVoteRepository = pollVoteRepository;
    }

    @Transactional
    public PollEntity createPoll(String roomId, String messageId, String creator, String question,
                                  List<String> options, boolean multiChoice, boolean anonymous) {
        PollEntity poll = new PollEntity();
        poll.setId(UUID.randomUUID().toString().substring(0, 8));
        poll.setRoomId(roomId);
        poll.setMessageId(messageId);
        poll.setCreator(creator);
        poll.setQuestion(question);
        poll.setMultiChoice(multiChoice);
        poll.setAnonymous(anonymous);
        poll.setClosed(false);
        poll.setCreatedAt(LocalDateTime.now().format(FORMATTER));

        List<PollOptionEntity> optionEntities = new ArrayList<>();
        for (int i = 0; i < options.size(); i++) {
            PollOptionEntity opt = new PollOptionEntity();
            opt.setPoll(poll);
            opt.setText(options.get(i));
            opt.setSortOrder(i);
            optionEntities.add(opt);
        }
        poll.setOptions(optionEntities);

        return pollRepository.save(poll);
    }

    @Transactional
    public boolean vote(String pollId, Long optionId, String username) {
        Optional<PollEntity> pollOpt = pollRepository.findById(pollId);
        if (pollOpt.isEmpty() || pollOpt.get().isClosed()) return false;

        PollEntity poll = pollOpt.get();

        // Verify option belongs to this poll
        boolean validOption = poll.getOptions().stream().anyMatch(o -> o.getId().equals(optionId));
        if (!validOption) return false;

        if (!poll.isMultiChoice()) {
            // Remove existing votes for this user in this poll
            List<PollVoteEntity> existing = pollVoteRepository.findByPollIdAndUsername(pollId, username);
            if (!existing.isEmpty()) {
                pollVoteRepository.deleteAll(existing);
            }
        } else {
            // Check if already voted for this option
            if (pollVoteRepository.existsByPollIdAndUsernameAndOptionId(pollId, username, optionId)) {
                return false; // already voted
            }
        }

        PollVoteEntity vote = new PollVoteEntity();
        vote.setPollId(pollId);
        vote.setOptionId(optionId);
        vote.setUsername(username);
        pollVoteRepository.save(vote);
        return true;
    }

    @Transactional
    public boolean retractVote(String pollId, Long optionId, String username) {
        if (pollVoteRepository.existsByPollIdAndUsernameAndOptionId(pollId, username, optionId)) {
            pollVoteRepository.deleteByPollIdAndUsernameAndOptionId(pollId, username, optionId);
            return true;
        }
        return false;
    }

    @Transactional
    public boolean closePoll(String pollId, String username) {
        Optional<PollEntity> pollOpt = pollRepository.findById(pollId);
        if (pollOpt.isEmpty()) return false;
        PollEntity poll = pollOpt.get();
        if (!poll.getCreator().equals(username)) return false;
        poll.setClosed(true);
        pollRepository.save(poll);
        return true;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPollData(String pollId) {
        Optional<PollEntity> pollOpt = pollRepository.findById(pollId);
        if (pollOpt.isEmpty()) return null;
        return buildPollData(pollOpt.get());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPollByMessageId(String messageId) {
        Optional<PollEntity> pollOpt = pollRepository.findByMessageId(messageId);
        if (pollOpt.isEmpty()) return null;
        return buildPollData(pollOpt.get());
    }

    private Map<String, Object> buildPollData(PollEntity poll) {
        List<PollVoteEntity> votes = pollVoteRepository.findByPollId(poll.getId());
        int totalVotes = votes.size();

        List<Map<String, Object>> optionResults = new ArrayList<>();
        for (PollOptionEntity opt : poll.getOptions()) {
            Map<String, Object> optData = new LinkedHashMap<>();
            optData.put("id", opt.getId());
            optData.put("text", opt.getText());
            long count = votes.stream().filter(v -> v.getOptionId().equals(opt.getId())).count();
            optData.put("votes", count);

            if (!poll.isAnonymous()) {
                List<String> voters = votes.stream()
                        .filter(v -> v.getOptionId().equals(opt.getId()))
                        .map(PollVoteEntity::getUsername)
                        .collect(Collectors.toList());
                optData.put("voters", voters);
            }
            optionResults.add(optData);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("pollId", poll.getId());
        result.put("messageId", poll.getMessageId());
        result.put("roomId", poll.getRoomId());
        result.put("question", poll.getQuestion());
        result.put("creator", poll.getCreator());
        result.put("multiChoice", poll.isMultiChoice());
        result.put("anonymous", poll.isAnonymous());
        result.put("closed", poll.isClosed());
        result.put("totalVotes", totalVotes);
        result.put("options", optionResults);
        result.put("createdAt", poll.getCreatedAt());
        return result;
    }
}
