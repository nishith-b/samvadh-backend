const Poll = require("../models/poll");
const User = require("../models/user");

//Create New Poll
exports.createPoll = async (req, res) => {
  const { question, type, options, creatorId } = req.body;

  if (!question || !type || !creatorId) {
    return res
      .status(400)
      .json({ message: "Question, type, and creatorId are required" });
  }

  try {
    let processedOptions = [];

    switch (type) {
      case "single-choice":
        if (!options || options.length < 2) {
          return res.status(400).json({
            message: "Single-choice poll must have at least two options",
          });
        }
        processedOptions = options.map((option) => ({
          optionText: option,
        }));
        break;

      case "open-ended":
        processedOptions = [];
        break;

      case "rating":
        processedOptions = [1, 2, 3, 4, 5].map((value) => ({
          optionText: value.toString(),
        }));
        break;

      case "yes/no":
        processedOptions = ["Yes", "No"].map((option) => ({
          optionText: option,
        }));
        break;

      case "image-based":
        if (!options || options.length < 2) {
          return res.status(400).json({
            message: "Image-based poll must have atleast image URLs",
          });
        }
        processedOptions = options.map((url) => ({ optionText: url }));
        break;

      default:
        return res.status(400).json({ message: "Invalid poll type" });
    }

    const newPoll = await Poll.create({
      question,
      type,
      options: processedOptions,
      creator: creatorId,
    });

    return res
      .status(201)
      .json({ message: "Poll created successfully", poll: newPoll });
  } catch (error) {
    return res.status(500).json({
      message: "Error in creating a poll",
      error: error.message,
    });
  }
};

//Get All Polls
exports.getAllPolls = async (req, res) => {
  const { type, creatorId, page = 1, limit = 10 } = req.query;
  const filter = {};
  const userId = req.user._id;

  if (type) filter.type = type;
  if (creatorId) filter.creator = creatorId;

  try {
    //Calculate Pagination Parameter
    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const skip = (pageNumber - 1) * pageSize;

    //Fetch Polls with pagination
    const polls = await Poll.find(filter)
      .populate("creator", "fullName username email profileImageUrl")
      .populate({
        path: "responses.voterId",
        select: "username profileImageUrl fullName",
      })
      .skip(skip)
      .limit(pageSize)
      .sort({ createdAt: -1 });

    //Add 'userHasVoted' flag for each poll
    const updatePolls = polls.map((poll) => {
      const userHasVoted = poll.voters.some((voterId) =>
        voterId.equals(userId)
      );
      return {
        ...poll.toObject(),
        userHasVoted,
      };
    });
    //Get total count of polls for pagination metadata
    const totalPolls = await Poll.countDocuments(filter);

    const stats = await Poll.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          type: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    //Ensure all types are included in stats, even those with zero counts

    const allTypes = [
      {
        type: "single-choice",
        label: "Single Choice",
      },
      {
        type: "yes/no",
        label: "Yes/No",
      },
      {
        type: "rating",
        label: "Rating",
      },
      {
        type: "image-based",
        label: "Image Based",
      },
      {
        type: "open-ended",
        label: "Open Ended",
      },
    ];
    const statsWithDefaults = allTypes
      .map((pollType) => {
        const stat = stats.find((item) => item.type === pollType.type);
        return {
          label: pollType.label,
          type: pollType.type,
          count: stat ? stat.count : 0,
        };
      })
      .sort((a, b) => b.count - a.count);
    res.status(200).json({
      polls: updatePolls,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalPolls / pageSize),
      totalPolls,
      stats: statsWithDefaults,
    });
  } catch (error) {
    console.error("Error fetching polls:", error);
    res.status(500).json({
      message: "Error fetching polls",
      error: error.message,
    });
  }
};

//Get Voted Polls
exports.getVotedPolls = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const userId = req.user._id;
  try {
    //Calculate Pagination Parameters
    const pageNumber = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const skip = (pageNumber - 1) * pageSize;

    //Fetch Polls where user has voted
    const polls = await Poll.find({ voters: userId }) //Filter by polls where the user's ID exists in voters
      .populate("creator", "fullName username email profileImageUrl")
      .populate({
        path: "responses.voterId",
        select: "username profileImageUrl fullName",
      })
      .skip(skip)
      .limit(pageSize);

    //Add 'userHasVoted' flag for each poll
    const updatePolls = polls.map((poll) => {
      const userHasVoted = poll.voters.some((voterId) =>
        voterId.equals(userId)
      );
      return {
        ...poll.toObject(),
        userHasVoted,
      };
    });

    //Get total count of voted polls for pagination metadata
    const totalVotedPolls = await Poll.countDocuments({ voters: userId });

    res.status(200).json({
      polls: updatePolls,
      currentPage: pageNumber,
      totalPages: Math.ceil(totalVotedPolls / pageSize),
      totalVotedPolls,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error Registering user",
      error: error.message,
    });
  }
};

//Get Poll By Id
exports.getPollById = async (req, res) => {
  const { id } = req.params;
  try {
    const poll = await Poll.findById(id)
      .populate("creator", "username email")
      .populate({
        path: "responses.voterId",
        select: "username profileImageUrl fullName",
      });
    if (!poll) {
      return res.status(404).json({ message: "poll not found" });
    }
    res.status(200).json(poll);
  } catch (error) {
    res.status(500).json({
      message: "Error Registering user",
      error: error.message,
    });
  }
};

//Vote on a Poll
exports.voteOnPoll = async (req, res) => {
  const { id } = req.params;
  const { optionIndex, responseText } = req.body; //Removed Voter Id from the req.body and extracted it from req.user._id
  voterId = req.user._id;

  try {
    const poll = await Poll.findById(id);
    if (!poll) {
      return res.status(404).json({ message: "Poll not Found" });
    }
    if (poll.closed) {
      return res.status(400).json({ message: "Poll is closed" });
    }
    if (poll.voters.includes(voterId)) {
      return res
        .status(400)
        .json({ message: "User has already voted on this poll" });
    }
    if (poll.type === "open-ended") {
      if (!responseText) {
        return res
          .status(400)
          .json({ message: "Response Text is required for open-ended polls" });
      }
      poll.responses.push({ voterId, responseText });
    } else {
      if (
        optionIndex === undefined ||
        optionIndex < 0 ||
        optionIndex >= poll.options.length
      ) {
        return res.status(400).json({ message: "Invalid Option Index" });
      }
      poll.options[optionIndex].votes += 1;
    }
    poll.voters.push(voterId);
    await poll.save();
    res.status(200).json(poll);
  } catch (error) {
    res.status(500).json({
      message: "Error Voting",
      error: error.message,
    });
  }
};

// Close the Poll
exports.closePoll = async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  try {
    const poll = await Poll.findById(id);

    if (!poll) {
      return res.status(404).json({ message: "Poll Not Found" });
    }

    if (poll.creator.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "You are not authorised to close this poll" });
    }

    if (poll.closed) {
      return res.status(400).json({ message: "Poll is already closed" });
    }

    poll.closed = true;
    await poll.save();

    return res.status(200).json({ message: "Poll closed successfully", poll });
  } catch (error) {
    res.status(500).json({
      message: "Error closing poll",
      error: error.message,
    });
  }
};

//Bookmark the Poll
exports.bookmarkPoll = async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User Not found" });
    }

    // Check if poll is already bookmarked
    const isBookmarked = user.bookmarkedPolls.includes(id);

    if (isBookmarked) {
      // Remove poll from bookmarks
      user.bookmarkedPolls = user.bookmarkedPolls.filter(
        (pollId) => pollId.toString() !== id
      );
      await user.save();
      return res.status(200).json({
        message: "Poll removed from bookmarks",
        bookmarkedPolls: user.bookmarkedPolls,
      });
    }

    // Add poll to bookmarks
    user.bookmarkedPolls.push(id);
    await user.save();

    await user.populate({
      // additional thing added
      path: "bookmarkedPolls",
      select: "question options createdAt closed",
    });

    res.status(200).json({
      message: "Poll bookmarked successfully",
      bookmarkedPolls: user.bookmarkedPolls,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating bookmarks",
      error: error.message,
    });
  }
};

//Get all Bookmarked Polls
exports.getBookmarkedPolls = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId).populate({
      path: "bookmarkedPolls",
      populate: [
        {
          path: "creator",
          select: "fullName username profileImageUrl",
        },
        {
          path: "responses",
          populate: {
            path: "voterId",
            select: "fullName username profileImageUrl", // this adds user info to each response
          },
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User Not found" });
    }

    const bookmarkedPolls = user.bookmarkedPolls;

    // Add 'userHasVoted' flag for each poll
    const updatePolls = bookmarkedPolls.map((poll) => {
      const userHasVoted = poll.voters.some((voterId) =>
        voterId.equals(userId)
      );

      return {
        ...poll.toObject(),
        userHasVoted,
      };
    });

    res.status(200).json({ bookmarkedPolls: updatePolls });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching bookmarked polls",
      error: error.message,
    });
  }
};

//Delete a Poll
exports.deletePoll = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const poll = await Poll.findById(id);

    if (!poll) {
      return res.status(404).json({
        message: "Poll not found",
      });
    }
    if (poll.creator.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "You are not authorised to close this poll" });
    }
    await Poll.findByIdAndDelete(id);
    return res.status(200).json({ message: "Poll deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Error Registering user",
      error: error.message,
    });
  }
};
